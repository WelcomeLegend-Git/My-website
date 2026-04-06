import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";
import { OAuth2Client } from "google-auth-library";
import { z } from "zod";
import type { PrismaClient } from "@prisma/client";

import { createAccessToken, createRefreshToken, verifyRefreshToken } from "../../auth/tokens";
import { env } from "../../env";
import { sendPasswordResetEmail } from "../../services/email";
import { procedure, router } from "../trpc";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

// Google OAuth client (lazy-initialised so server boots even without client id)
let _googleClient: OAuth2Client | null = null;
const getGoogleClient = () => {
  if (!_googleClient && env.GOOGLE_CLIENT_ID) {
    _googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);
  }
  return _googleClient;
};

/**
 * Helper: create default subjects + chapters for a brand-new user.
 */
const seedDefaultSubjects = async (
  prisma: PrismaClient,
  userId: string
) => {
  const defaultSubjects = [
    {
      name: "Physics",
      description: "Mechanics, Electromagnetism, Optics, and Modern Physics",
      chapters: [
        "Kinematics",
        "Laws of Motion",
        "Work, Energy and Power",
        "Rotational Motion",
        "Electrostatics",
      ],
    },
    {
      name: "Chemistry",
      description: "Physical, Organic, and Inorganic Chemistry",
      chapters: [
        "Atomic Structure",
        "Chemical Bonding",
        "Thermodynamics",
        "Equilibrium",
        "Organic Basics",
      ],
    },
    {
      name: "Mathematics",
      description: "Algebra, Calculus, Coordinate Geometry, and Vectors",
      chapters: [
        "Quadratic Equations",
        "Sequences and Series",
        "Limits and Continuity",
        "Differential Calculus",
        "Coordinate Geometry",
      ],
    },
  ];

  await Promise.all(
    defaultSubjects.map(async (subject) => {
      const created = await prisma.subject.create({
        data: {
          name: subject.name,
          description: subject.description,
          ownerId: userId,
        },
      });

      await prisma.chapter.createMany({
        data: subject.chapters.map((chapter) => ({
          title: chapter,
          subjectId: created.id,
        })),
      });
    })
  );
};

export const authRouter = router({
  register: procedure
    .input(
      credentialsSchema.extend({
        name: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.user.findUnique({ where: { email: input.email } });
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "Email already registered" });
      }

      const passwordHash = await bcrypt.hash(input.password, 12);

      const user = await ctx.prisma.user.create({
        data: {
          email: input.email,
          name: input.name,
          passwordHash,
        },
      });

      await seedDefaultSubjects(ctx.prisma, user.id);

      const tokens = {
        accessToken: createAccessToken({ sub: user.id, email: user.email }),
        refreshToken: createRefreshToken({ sub: user.id, email: user.email }),
      };

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
        ...tokens,
      };
    }),

  // ─── Google OAuth Login / Register ───────────────────────
  googleLogin: procedure
    .input(z.object({ credential: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const client = getGoogleClient();
      if (!client || !env.GOOGLE_CLIENT_ID) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Google sign-in is not configured on this server",
        });
      }

      // 1. Verify the Google ID token
      let payload;
      try {
        const ticket = await client.verifyIdToken({
          idToken: input.credential,
          audience: env.GOOGLE_CLIENT_ID,
        });
        payload = ticket.getPayload();
      } catch (error) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid Google credential",
          cause: error,
        });
      }

      if (!payload || !payload.email) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Google account has no email" });
      }

      const googleId = payload.sub;
      const email = payload.email;
      const name = payload.name || email.split("@")[0];

      // 2. Find existing user by googleId OR email
      let user = await ctx.prisma.user.findUnique({ where: { googleId } });

      if (!user) {
        // Check if user exists with same email (registered via email/password)
        user = await ctx.prisma.user.findUnique({ where: { email } });

        if (user) {
          // Link Google account to existing email/password user
          user = await ctx.prisma.user.update({
            where: { id: user.id },
            data: { googleId },
          });
        } else {
          // Brand-new user via Google — create account
          user = await ctx.prisma.user.create({
            data: {
              email,
              name,
              googleId,
              passwordHash: null,
            },
          });

          // Seed default subjects for new user
          await seedDefaultSubjects(ctx.prisma, user.id);
        }
      }

      // 3. Issue JWT tokens
      const tokens = {
        accessToken: createAccessToken({ sub: user.id, email: user.email }),
        refreshToken: createRefreshToken({ sub: user.id, email: user.email }),
      };

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
        ...tokens,
      };
    }),

  requestPasswordReset: procedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findUnique({ where: { email: input.email } });

      if (user) {
        const otp = Math.floor(100000 + Math.random() * 900000)
          .toString()
          .slice(0, 6);
        const otpHash = await bcrypt.hash(otp, 12);

        await ctx.prisma.passwordResetToken.updateMany({
          where: {
            userId: user.id,
            used: false,
            expiresAt: {
              gt: new Date(),
            },
          },
          data: {
            used: true,
          },
        });

        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        await ctx.prisma.passwordResetToken.create({
          data: {
            userId: user.id,
            otpHash,
            expiresAt,
          },
        });

        try {
          await sendPasswordResetEmail({
            to: user.email,
            code: otp,
            expiresInMinutes: 10,
          });
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to send reset email. Please try again later.",
            cause: error,
          });
        }
      }

      return { success: true };
    }),
  resetPasswordWithOtp: procedure
    .input(
      z.object({
        email: z.string().email(),
        otp: z.string().min(4).max(8),
        newPassword: z.string().min(8),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findUnique({ where: { email: input.email } });
      if (!user) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid code or email" });
      }

      const token = await ctx.prisma.passwordResetToken.findFirst({
        where: {
          userId: user.id,
          used: false,
          expiresAt: {
            gt: new Date(),
          },
        },
        orderBy: { createdAt: "desc" },
      });

      if (!token) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid or expired code" });
      }

      const valid = await bcrypt.compare(input.otp, token.otpHash);
      if (!valid) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid or expired code" });
      }

      const passwordHash = await bcrypt.hash(input.newPassword, 12);

      await ctx.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      });

      await ctx.prisma.passwordResetToken.update({
        where: { id: token.id },
        data: { used: true },
      });

      return { success: true };
    }),
  login: procedure.input(credentialsSchema).mutation(async ({ ctx, input }) => {
    const user = await ctx.prisma.user.findUnique({ where: { email: input.email } });
    if (!user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid credentials" });
    }

    // User registered via Google only — no password set
    if (!user.passwordHash) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "This account uses Google sign-in. Please use the Google button to log in.",
      });
    }

    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid credentials" });
    }

    const tokens = {
      accessToken: createAccessToken({ sub: user.id, email: user.email }),
      refreshToken: createRefreshToken({ sub: user.id, email: user.email }),
    };

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      ...tokens,
    };
  }),
  refresh: procedure
    .input(z.object({ refreshToken: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      try {
        const payload = verifyRefreshToken(input.refreshToken);
        const user = await ctx.prisma.user.findUnique({ where: { id: payload.sub } });
        if (!user) {
          throw new TRPCError({ code: "UNAUTHORIZED" });
        }
        return {
          accessToken: createAccessToken({ sub: user.id, email: user.email }),
          refreshToken: createRefreshToken({ sub: user.id, email: user.email }),
        };
      } catch (error) {
        throw new TRPCError({ code: "UNAUTHORIZED", cause: error });
      }
    }),
  me: procedure.query(({ ctx }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }

    return ctx.prisma.user.findUnique({
      where: { id: ctx.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
    });
  }),
});