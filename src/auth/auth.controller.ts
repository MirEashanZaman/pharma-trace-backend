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
import {
    RegisterDto,
    LoginDto,
    Web3LoginDto,
    ForgotPasswordDto,
    VerifyOtpDto,
    ResetPasswordDto,
} from './dto/auth.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { Roles } from './roles.decorator';
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

    @Post('forgot-password')
    forgotPassword(@Body() dto: ForgotPasswordDto) {
        return this.authService.forgotPassword(dto);
    }

    @Post('verify-otp')
    verifyOtp(@Body() dto: VerifyOtpDto) {
        return this.authService.verifyOtp(dto);
    }

    @Post('reset-password')
    resetPassword(@Body() dto: ResetPasswordDto) {
        return this.authService.resetPassword(dto);
    }

    @UseGuards(JwtAuthGuard)
    @Get('profile')
    getProfile(@Request() req: any) {
        return this.authService.getProfile(req.user.userId);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.REGULATOR)
    @Get('users')
    getUsers(
        @Query('role') role?: UserRole,
        @Query('limit') limit?: string,
    ) {
        return this.authService.getUsers(role, limit ? Number(limit) : undefined);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.REGULATOR)
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

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @Delete('users/:id')
    deleteUser(@Param('id') id: string) {
        return this.authService.deleteUser(Number(id));
    }
}
