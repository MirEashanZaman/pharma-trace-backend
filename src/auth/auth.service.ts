import {
    Injectable,
    UnauthorizedException,
    ConflictException,
    BadRequestException,
    ForbiddenException,
    OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { User, UserRole } from './entities/user.entity';
import { RegisterDto, LoginDto, Web3LoginDto } from './dto/auth.dto';
import { BlockchainService } from '../blockchain/blockchain.service';

@Injectable()
export class AuthService implements OnModuleInit {
    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        private readonly jwtService: JwtService,
        private readonly blockchainService: BlockchainService,
    ) {}

    async onModuleInit() {
        await this.seedDefaultAccounts();
    }

    async seedDefaultAccounts() {
        const admin = await this.userRepository.findOne({
            where: { email: 'admin@pharma.com' },
        });
        if (admin) {
            return;
        }

        const defaultPassword = await bcrypt.hash('123456', 10);
        const usersToSeed = [
            {
                email: 'admin@pharma.com',
                password: defaultPassword,
                fullName: 'System Administrator',
                role: UserRole.ADMIN,
                organization: 'PharmaTrace Governance',
                walletAddress: '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266',
            },
            {
                email: 'manufacturer@pharma.com',
                password: defaultPassword,
                fullName: 'Novartis Production Lead',
                role: UserRole.MANUFACTURER,
                organization: 'Novartis Global',
                walletAddress: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
            },
            {
                email: 'distributor@pharma.com',
                password: defaultPassword,
                fullName: 'DHL Cold-Chain Logistics',
                role: UserRole.DISTRIBUTOR,
                organization: 'DHL Healthcare Logistics',
                walletAddress: '0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc',
            },
            {
                email: 'pharmacy@pharma.com',
                password: defaultPassword,
                fullName: 'CVS Central Pharmacy',
                role: UserRole.PHARMACY,
                organization: 'CVS Health Care',
                walletAddress: '0x90f79bf6eb2c4f870365e785982e1f101e93b906',
            },
            {
                email: 'regulator@pharma.com',
                password: defaultPassword,
                fullName: 'FDA Inspection Officer',
                role: UserRole.REGULATOR,
                organization: 'Food and Drug Administration',
                walletAddress: '0x15d34aaf54267db7d7c367839aaf71a00a2c6a65',
            },
            {
                email: 'customer@pharma.com',
                password: defaultPassword,
                fullName: 'MirEashan Zaman',
                role: UserRole.CUSTOMER,
                organization: 'Public Consumer / Patient',
                walletAddress: '0xcd3b766cc5027d11055150d60447de35e1008473',
            },
        ];

        for (const u of usersToSeed) {
            const exists = await this.userRepository.findOne({ where: { email: u.email } });
            if (!exists) {
                await this.userRepository.save(this.userRepository.create(u));
            } else if (exists.fullName !== u.fullName) {
                exists.fullName = u.fullName;
                await this.userRepository.save(exists);
            }
        }
    }

    
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

    
    private readonly activeNonces: Map<string, { nonce: string; expiresAt: number }> = new Map();

    generateChallenge(walletAddress: string): { challenge: string; nonce: string; expiresAt: number } {
        const normalized = walletAddress.toLowerCase();
        const nonce = Math.random().toString(36).substring(2) + Date.now().toString(36);
        const expiresAt = Date.now() + 5 * 60 * 1000;
        this.activeNonces.set(normalized, { nonce, expiresAt });
        const challenge = `PharmaTrace Authentication\nWallet: ${normalized}\nNonce: ${nonce}\nIssued At: ${new Date().toISOString()}`;
        return { challenge, nonce, expiresAt };
    }

    async web3Login(dto: Web3LoginDto) {
        const normalizedAddress = dto.walletAddress.toLowerCase();
        const activeNonce = this.activeNonces.get(normalizedAddress);

        if (activeNonce) {
            if (Date.now() > activeNonce.expiresAt) {
                this.activeNonces.delete(normalizedAddress);
                throw new UnauthorizedException('Challenge nonce has expired. Please request a new challenge.');
            }
            if (!dto.message.includes(activeNonce.nonce)) {
                throw new UnauthorizedException('Signed message does not contain active challenge nonce.');
            }
            this.activeNonces.delete(normalizedAddress);
        }

        const isValid = this.blockchainService.verifyWalletSignature(
            dto.message,
            dto.signature,
            dto.walletAddress
        );

        if (!isValid) {
            throw new UnauthorizedException('Invalid cryptographic wallet signature');
        }

        if (dto.role === UserRole.ADMIN) {
            throw new ForbiddenException('Admin role cannot be self-assigned via Web3 registration');
        }

        let user = await this.userRepository.findOne({
            where: { walletAddress: normalizedAddress },
        });

        if (!user) {
            const assignedRole = dto.role || UserRole.PHARMACY;
            user = this.userRepository.create({
                email: `${normalizedAddress.slice(0, 10)}@wallet.pharma`,
                walletAddress: normalizedAddress,
                role: assignedRole,
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

    async getUsers(role?: UserRole, limit?: number) {
        const where: any = {};
        if (role) {
            where.role = role;
        }
        const users = await this.userRepository.find({
            where: Object.keys(where).length > 0 ? where : undefined,
            take: limit ? Number(limit) : undefined,
            order: { id: 'ASC' },
        });
        return users.map(({ password, ...safeUser }) => safeUser);
    }

    async getUserById(id: number) {
        const user = await this.userRepository.findOne({ where: { id } });
        if (!user) {
            throw new BadRequestException(`User with id ${id} not found`);
        }
        const { password, ...safeUser } = user;
        return safeUser;
    }

    async updateProfile(userId: number, updateData: { fullName?: string; organization?: string }) {
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (!user) {
            throw new UnauthorizedException('User not found');
        }
        if (updateData.fullName !== undefined) {
            user.fullName = updateData.fullName;
        }
        if (updateData.organization !== undefined) {
            user.organization = updateData.organization;
        }
        const updated = await this.userRepository.save(user);
        const { password, ...safeUser } = updated;
        return safeUser;
    }

    async deleteUser(id: number) {
        const user = await this.userRepository.findOne({ where: { id } });
        if (!user) {
            throw new BadRequestException(`User with id ${id} not found`);
        }
        await this.userRepository.remove(user);
        return { deleted: true, id };
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
