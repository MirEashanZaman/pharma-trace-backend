import {
    Controller,
    Post,
    Body,
    Get,
    UseGuards,
    Request,
    Param,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, Web3LoginDto } from './dto/auth.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

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
}
