import {Module} from '@nestjs/common';
import {SequelizeModule} from '@nestjs/sequelize';
import {AuthnService} from '../authn/authn.service';
import {AuthzModule} from '../authz/authz.module';
import {ConfigModule} from '../config/config.module';
import {ConfigService} from '../config/config.service';
import {TokenModule} from '../token/token.module';
import {User} from '../users/user.model';
import {UsersService} from '../users/users.service';
import {ApiKeyController} from './apikey.controller';
import {ApiKey} from './apikey.model';
import {ApiKeyService} from './apikey.service';

@Module({
  imports: [
    SequelizeModule.forFeature([ApiKey, User]),
    AuthzModule,
    ConfigModule,
    ApiKeyModule,
    TokenModule
  ],
  providers: [ConfigService, AuthnService, UsersService, ApiKeyService],
  exports: [SequelizeModule, ApiKeyService],
  controllers: [ApiKeyController]
})
export class ApiKeyModule {}
