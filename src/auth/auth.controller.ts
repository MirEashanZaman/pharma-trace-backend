import {
    Controller,
    Post,
    Body,
    Get,
    Put,
    Delete,
    UseGuards,
    Request,
    Param,
    Query,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, Web3LoginDto } from './dto/auth.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { UserRole } from './entities/user.entity';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @Get('challenge/:walletAddress')
    getChallenge(@Param('walletAddress') walletAddress: string) {
        return this.authService.generateChallenge(walletAddress);
    }

    @Post('register')
    register(@Body() dto: RegisterDto) {
        return this.authService.register(dto);
    }

    @Post('login')
    login(@Body() dto: LoginDto) {
        return this.authService.login(dto);
    }

    @Post('web3-login')
    web3Login(@Body() dto: Web3LoginDto) {
        return this.authService.web3Login(dto);
    }

    @UseGuards(JwtAuthGuard)
    @Get('profile')
    getProfile(@Request() req: any) {
        return this.authService.getProfile(req.user.userId);
    }

    @UseGuards(JwtAuthGuard)
    @Get('users')
    getUsers(
        @Query('role') role?: UserRole,
        @Query('limit') limit?: string,
    ) {
        return this.authService.getUsers(role, limit ? Number(limit) : undefined);
    }

    @UseGuards(JwtAuthGuard)
    @Get('users/:id')
    getUserById(@Param('id') id: string) {
        return this.authService.getUserById(Number(id));
    }

    @UseGuards(JwtAuthGuard)
    @Put('profile')
    updateProfile(
        @Request() req: any,
        @Body() body: { fullName?: string; organization?: string },
    ) {
        return this.authService.updateProfile(req.user.userId, body);
    }

    @UseGuards(JwtAuthGuard)
    @Delete('users/:id')
    deleteUser(@Param('id') id: string) {
        return this.authService.deleteUser(Number(id));
    }
}
