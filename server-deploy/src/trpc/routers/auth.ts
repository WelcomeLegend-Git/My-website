import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { createAccessToken, createRefreshToken, verifyRefreshToken } from "../../auth/tokens";
import { procedure, router } from "../trpc";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

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
          const created = await ctx.prisma.subject.create({
            data: {
              name: subject.name,
              description: subject.description,
              ownerId: user.id,
            },
          });

          await ctx.prisma.chapter.createMany({
            data: subject.chapters.map((chapter) => ({
              title: chapter,
              subjectId: created.id,
            })),
          });
        })
      );

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
  login: procedure.input(credentialsSchema).mutation(async ({ ctx, input }) => {
    const user = await ctx.prisma.user.findUnique({ where: { email: input.email } });
    if (!user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid credentials" });
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