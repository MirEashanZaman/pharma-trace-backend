function getJwtSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret && process.env.NODE_ENV === 'production') {
        throw new Error('FATAL: JWT_SECRET environment variable is missing in production environment');
    }
    return secret || 'PharmaTrace_Super_Secure_JWT_Secret_Key_2026';
}

export const jwtConstants = {
    secret: getJwtSecret(),
    expiresIn: '7d',
};
