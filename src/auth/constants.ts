export const jwtConstants = {
    secret: process.env.JWT_SECRET || 'PharmaTrace_Super_Secure_JWT_Secret_Key_2026',
    expiresIn: '7d',
};
