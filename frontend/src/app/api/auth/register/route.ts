import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { signJwt } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { username, password, registration_code } = await request.json();

    if (!username || !password || !registration_code) {
      return NextResponse.json(
        { detail: 'Username, password, and registration code are required' },
        { status: 400 }
      );
    }

    // Verify registration code
    const regCode = await prisma.registrationCode.findUnique({
      where: { code: registration_code },
    });

    if (!regCode) {
      return NextResponse.json(
        { detail: 'Mã đăng ký không hợp lệ' },
        { status: 400 }
      );
    }

    if (regCode.isUsed) {
      return NextResponse.json(
        { detail: 'Mã đăng ký này đã được sử dụng' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { username },
    });

    if (existingUser) {
      return NextResponse.json(
        { detail: 'Username already registered' },
        { status: 400 }
      );
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    // Create user and update code in a transaction
    const newUser = await prisma.$transaction(async (tx: any) => {
      const user = await tx.user.create({
        data: {
          username,
          password_hash,
          role: 'user', // Default role
        },
      });

      await tx.registrationCode.update({
        where: { id: regCode.id },
        data: {
          isUsed: true,
          usedByUsername: username,
        },
      });

      return user;
    });

    const token = signJwt({ sub: newUser.username, id: newUser.id, role: newUser.role });

    return NextResponse.json({
      message: 'User created successfully',
      access_token: token,
      token_type: 'bearer',
      user: {
        id: newUser.id,
        username: newUser.username,
        role: newUser.role,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { detail: 'Internal server error' },
      { status: 500 }
    );
  }
}
