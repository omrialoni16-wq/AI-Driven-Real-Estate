const MIN_JWT_SECRET_LENGTH = 32;

const secret = process.env.JWT_SECRET;

if (!secret || secret.trim().length < MIN_JWT_SECRET_LENGTH) {
  console.error(
    `JWT_SECRET is missing or too short (must be at least ${MIN_JWT_SECRET_LENGTH} characters). ` +
      `Refusing to start. Generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`,
  );
  process.exit(1);
}
