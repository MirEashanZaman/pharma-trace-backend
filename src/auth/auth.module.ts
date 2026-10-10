import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { User } from './entities/user.entity';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { jwtConstants } from './constants';
import { BlockchainModule } from '../blockchain/blockchain.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([User]),
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({
            secret: jwtConstants.secret,
            signOptions: { expiresIn: '7d' },
        }),
        BlockchainModule,
    ],
    controllers: [AuthController],
    providers: [AuthService, JwtStrategy],
    exports: [AuthService, JwtStrategy, PassportModule],
})
export class AuthModule {}
