import {
    Injectable,
    UnauthorizedException,
    ConflictException,
    BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { User, UserRole } from './entities/user.entity';
import { RegisterDto, LoginDto, Web3LoginDto } from './dto/auth.dto';
import { BlockchainService } from '../blockchain/blockchain.service';

@Injectable()
export class AuthService {
    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        private readonly jwtService: JwtService,
        private readonly blockchainService: BlockchainService,
    ) {}

    
    async register(dto: RegisterDto) {
        const existing = await this.userRepository.findOne({
            where: { email: dto.email },
        });
        if (existing) {
            throw new ConflictException('Email already registered');
        }

        const hashedPassword = await bcrypt.hash(dto.password, 10);
        const user = this.userRepository.create({
            ...dto,
            password: hashedPassword,
        });

        const saved = await this.userRepository.save(user);
        return this.generateToken(saved);
    }

    
    async login(dto: LoginDto) {
        const user = await this.userRepository.findOne({
            where: { email: dto.email },
        });
        if (!user || !user.password) {
            throw new UnauthorizedException('Invalid credentials');
        }

        const isMatch = await bcrypt.compare(dto.password, user.password);
        if (!isMatch) {
            throw new UnauthorizedException('Invalid credentials');
        }

        return this.generateToken(user);
    }

    
    async web3Login(dto: Web3LoginDto) {
        const isValid = this.blockchainService.verifyWalletSignature(
            dto.message,
            dto.signature,
            dto.walletAddress
        );

        if (!isValid) {
            throw new UnauthorizedException('Invalid cryptographic wallet signature');
        }

        let user = await this.userRepository.findOne({
            where: { walletAddress: dto.walletAddress.toLowerCase() },
        });

        if (!user) {
            
            user = this.userRepository.create({
                email: `${dto.walletAddress.toLowerCase().slice(0, 10)}@wallet.pharma`,
                walletAddress: dto.walletAddress.toLowerCase(),
                role: dto.role || UserRole.MANUFACTURER,
                organization: dto.organization || 'Web3 Signer',
            });
            user = await this.userRepository.save(user);
        }

        return this.generateToken(user);
    }

    
    async getProfile(userId: number) {
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (!user) {
            throw new UnauthorizedException('User not found');
        }
        const { password, ...safeUser } = user;
        return safeUser;
    }

    private generateToken(user: User) {
        const payload = {
            sub: user.id,
            email: user.email,
            role: user.role,
            walletAddress: user.walletAddress,
        };

        return {
            accessToken: this.jwtService.sign(payload),
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                walletAddress: user.walletAddress,
                organization: user.organization,
            },
        };
    }
}
