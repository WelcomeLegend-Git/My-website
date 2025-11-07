import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { requireUser } from "../middleware/auth";
import { procedure, router } from "../trpc";

const subjectInput = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(400).optional().nullable(),
});

const chapterInput = z.object({
  subjectId: z.string().min(1),
  title: z.string().min(1).max(180),
  description: z.string().max(600).optional().nullable(),
});

export const subjectsRouter = router({
  list: procedure.use(requireUser).query(({ ctx }) =>
    ctx.prisma.subject.findMany({
      where: { ownerId: ctx.user.id },
      orderBy: { createdAt: "asc" },
      include: {
        chapters: {
          orderBy: { createdAt: "asc" },
        },
      },
    })
  ),
  create: procedure.use(requireUser).input(subjectInput).mutation(async ({ ctx, input }) => {
    return ctx.prisma.subject.create({
      data: {
        name: input.name,
        description: input.description,
        ownerId: ctx.user.id,
      },
    });
  }),
  update: procedure
    .use(requireUser)
    .input(subjectInput.merge(z.object({ id: z.string().min(1) })))
    .mutation(async ({ ctx, input }) => {
      const subject = await ctx.prisma.subject.findUnique({ where: { id: input.id } });
      if (!subject || subject.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return ctx.prisma.subject.update({
        where: { id: input.id },
        data: {
          name: input.name,
          description: input.description,
        },
      });
    }),
  remove: procedure
    .use(requireUser)
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const subject = await ctx.prisma.subject.findUnique({ where: { id: input.id } });
      if (!subject || subject.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      await ctx.prisma.subject.delete({ where: { id: input.id } });
      return { success: true };
    }),
  createChapter: procedure
    .use(requireUser)
    .input(chapterInput)
    .mutation(async ({ ctx, input }) => {
      const subject = await ctx.prisma.subject.findUnique({ where: { id: input.subjectId } });
      if (!subject || subject.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return ctx.prisma.chapter.create({
        data: {
          subjectId: input.subjectId,
          title: input.title,
          description: input.description,
        },
      });
    }),
  updateChapter: procedure
    .use(requireUser)
    .input(
      chapterInput.merge(
        z.object({
          id: z.string().min(1),
        })
      )
    )
    .mutation(async ({ ctx, input }) => {
      const chapter = await ctx.prisma.chapter.findUnique({
        where: { id: input.id },
        include: { subject: true },
      });
      if (!chapter || chapter.subject.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return ctx.prisma.chapter.update({
        where: { id: input.id },
        data: {
          title: input.title,
          description: input.description,
        },
      });
    }),
  removeChapter: procedure
    .use(requireUser)
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const chapter = await ctx.prisma.chapter.findUnique({
        where: { id: input.id },
        include: { subject: true },
      });
      if (!chapter || chapter.subject.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      await ctx.prisma.chapter.delete({ where: { id: input.id } });
      return { success: true };
    }),
});