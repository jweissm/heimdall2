import {ExecJSON} from 'inspecjs';
import _ from 'lodash';
import {version as HeimdallToolsVersion} from '../package.json';
import {BaseConverter, ILookupPath, MappedTransform} from './base-converter';
import {
  DEFAULT_STATIC_CODE_ANALYSIS_NIST_TAGS,
} from './utils/global';
enum scannerType {
  Moldy = 'Moldy',
  Stigma = 'Stigma', 
  CodeQuality = 'CodeQuality'
}
function createDescription(
  data: Record<string, unknown>,
  score: number,
  date: string,
  scannerName: string,
  endTime:string
): Record<string, unknown> {
  let desc = '';
  if (scannerName === scannerType.Moldy || scannerName == scannerType.Stigma) {
    desc =`
     title_text:${(_.get(data, 'title_text') as string)}
      body:${ _.get(data, 'body')}
      body_format:${(_.get(data, 'body_format') as string)}
      classificaton:${(_.get(data, 'classification') as string)}
      depth:${(_.get(data, 'depth') as string)}
      heuristic_heur_id:${(_.get(data, 'heuristic.heur_id') as string)}
      heuristic_score:${(_.get(data, 'heuristic.score') as string)}
      heuristic_name:${(_.get(data, 'heuristic.name') as string)}
      `;
  } else if (scannerName === scannerType.CodeQuality) {
    desc =
      `body:${_.get(data, 'body')}
      body_format:${(_.get(data, 'body_format') as string)}
      classificaton:${(_.get(data, 'classification') as string)}
      depth:${(_.get(data, 'depth') as string)}
      title_text:${(_.get(data, 'title_text') as string)}
      `;
  } else {
    desc = JSON.stringify(data);
  }
  return {
    status: determineStatus(score),
    code_desc: desc,
    start_time: date,
    run_time:  new Date(endTime).valueOf() - new Date(date).valueOf()
  };
}

function childrenfinder(currLevel: Record<string, unknown>): string[][] {
  const arr: string[][] = [];
  for (const [sha, file] of Object.entries(currLevel)) {
    if (_.has(file, 'name')) {
      const name: string = _.get(file, 'name[0]') || '';
      arr.push([sha, name]);
    }
    if (_.has(file, 'children')) {
      const nextLevel: Record<string, unknown> = _.get(file, 'children') || {};
      for ( const element of childrenfinder(nextLevel)) {
        arr.push(element);
      };
    }
  };
  return arr;
}
function sha2filenameMapper(
  results: Record<string, unknown>
): Record<string, unknown> {
  const toplevel = _.get(results, 'api_response.file_tree') as Record<
    string,
    unknown
  >;
  const shaMappings = {};
  const arr = childrenfinder(toplevel)
  arr.forEach((value) => {
    const sha: string = value[0] || '';
    const filename: string = value[1] || '';
    _.set(shaMappings, sha, filename);
  });
  return shaMappings;
}
function determineStatus(score: number): ExecJSON.ControlResultStatus {
  if (score == 0) {
    return ExecJSON.ControlResultStatus.Passed;
  }
  return ExecJSON.ControlResultStatus.Failed;
}

function arrayifyObject(
  parsed: Record<string, unknown>,
  mappings: Record<string, unknown>
): Record<string, unknown> {
  const results = _.get(parsed, 'api_response.results') as Record<string, unknown>;
  const newout: Record<string, unknown>[] = [];
  _.forEach(results, (result) => {
    const temp = result as Record<string, unknown>;
    const sha: string = _.get(result, 'sha256') || '';
    _.set(temp, 'filename', _.get(mappings, sha));
    const descriptions = _.map(
      _.get(temp, 'result.sections') as Record<string, unknown>[],
      (val) =>
        createDescription(
          val as Record<string, unknown>,
          _.get(temp, 'result.score') as number,
          _.get(temp, 'response.milestones.service_started') as string,
          _.get(temp, 'response.service_name') as string,
          _.get(temp, 'response.milestones.service_completed') as string
        )
    );
    if (descriptions.length == 0) {
      descriptions.push({
        status: ExecJSON.ControlResultStatus.Passed,
        code_desc: 'NA',
        start_time: _.get(temp, 'response.milestones.service_started') as string
      });
    }
    _.set(temp, 'result.sections', descriptions);
    newout.push(temp);
  });
  const groups = _.groupBy(newout, (result) => {
    return _.get(result, 'response.service_name');
  });
  return groups;
}

function controlMappingConveyor(): MappedTransform<
  ExecJSON.Control & ILookupPath,
  ILookupPath
> {
  return {
    id: {path: 'sha256'},
    title: {path: 'filename'},
    desc: '',
    impact: {
      path: 'result.score',
      transformer: (value) => {
        return value / 1000;
      }
    },
    refs: [],
    tags: {
      archive_ts: {path: 'archive_ts'},
      classification: {path:'classification'},
      expiry_ts: {path: 'expiry_ts'},
      size: {path:'size'},
      type: {path:'type'},
      nist: DEFAULT_STATIC_CODE_ANALYSIS_NIST_TAGS

    },
    source_location: {
      ref: ''
    },
    results: [
      {
        path: 'result.sections',
        status: {path: 'status'},
        code_desc: {path: 'code_desc'},
        start_time: {path: 'start_time'},
        run_time: {path:'run_time'}
      }
    ]
  };
}

export class ConveyorMapper extends BaseConverter {
  data: Record<string, unknown>;
  scannerName: string;
  mappings: MappedTransform<
    ExecJSON.Execution & {passthrough: unknown},
    ILookupPath
  > =  {
      passthrough: {path: 'api_response'},
      platform: {
        name: 'Heimdall Tools',
        release: HeimdallToolsVersion
      },
      version: {path: 'api_server_version'},
      statistics: {},
      profiles: [
        {
          name: {path: 'api_response.results[0].response.service_name'},
          version: {path: 'api_response.results[0].response.service_version'},
          title: {path: 'api_response.params.description'},
          supports: [],
          attributes: [],
          groups: [],
          status: 'loaded',
          controls: [
            {
              path: 'api_response.results',
              ...controlMappingConveyor()
            }
          ],
          sha256: ''
        }
      ]
  }
  constructor(
    remappedConveyorResults: Record<string, unknown>,
    data: Record<string, unknown>,
    scannerName: string
  ) {
    _.set(data, 'api_response.results', remappedConveyorResults);
    super(data);
    this.scannerName = scannerName;
    this.data = data;
  }
}

export class ConveyorResults {
  data: Record<string,unknown>;
  constructor(conveyorJson: string) {
    const parsed = JSON.parse(conveyorJson);
    const mappings = sha2filenameMapper(parsed);
    const newres = arrayifyObject(parsed, mappings);
    this.data = _.set(parsed, 'api_response.results', newres);
  }

  toHdf(): Record<string, ExecJSON.Execution> {
    const scannerRecordInput =  (Object.entries(_.get(this.data, 'api_response.results') as Record<string, unknown> ) as [string, Record<string, unknown>][]).map(([scannerName, scannerData]) =>
      [scannerName, new ConveyorMapper(
        scannerData,
        this.data,
        scannerName
      ).toHdf()]
    );
    return Object.fromEntries(scannerRecordInput)
  }
}
