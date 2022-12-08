import {ExecJSON} from 'inspecjs';
import _ from 'lodash';
import {version as HeimdallToolsVersion} from '../package.json';
import {BaseConverter, ILookupPath, MappedTransform} from './base-converter';

function formatMessage(input: Record<string, unknown>): string {
  return `${_.get(input, 'file')}, line:${_.get(input, 'line')}, column:${_.get(input, 'column')}`;
}
/*function nistTag(id: string): string[] {
  return NIKTO_NIST_MAPPING.nistTag(id);
}*/

export class GoSecMapper extends BaseConverter {
  withRaw: boolean;

  mappings: MappedTransform<
    ExecJSON.Execution,
    ILookupPath
  > = {
    platform: {
      name: 'Heimdall Tools',
      release: HeimdallToolsVersion,
    },
    version: HeimdallToolsVersion,
    statistics: {},
    profiles: [
      {
        name: 'Gosec scanner',
        title: 'gosec',
        version: {path: 'GosecVersion'},
        supports: [],
        attributes: [],
        groups: [],
        status: 'loaded',
        controls: [
          {
            path: 'issues',
            key: 'id',
            tags: {
              nist: {path: 'cwe'},
              cwe: {path:'cwe'},
              nosec: {path:'nosec'},
              suppressions: {path: 'supressions'},
              severity:{path: 'severity'},
              confidence:{path: 'confidence'}
            },
            refs: [],
            source_location: {},
            title: {path: 'details'},
            id: {path: 'rule_id'},
            desc: "",
            impact: 0.5,
            results: [
              {
                status: ExecJSON.ControlResultStatus.Failed,
                code_desc: {path: 'code'},
                message:{transformer: formatMessage},
                start_time: ''
              }
            ]
          }
        ],
        sha256: ''
      }
    ],
  };
  constructor(gosecJson: string, withRaw = false) {
    super(JSON.parse(gosecJson));
    this.withRaw = withRaw;
  }
}
