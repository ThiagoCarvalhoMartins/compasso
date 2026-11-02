import { prisma } from "../lib/prisma";
import { revokeAllRefreshTokens } from "../lib/tokens";

/**
 * RN13 — exclusão de conta: os dados pessoais e o conteúdo dos blocos são apagados na hora
 * (dentro do prazo de 30 dias); sessões QP e atividade ficam como métricas anônimas.
 */
export async function deleteAccount(id: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id } });
  await prisma.$transaction([
    prisma.block.deleteMany({ where: { userId: id } }),
    prisma.category.deleteMany({ where: { userId: id } }),
    prisma.qpSession.updateMany({ where: { userId: id }, data: { userId: null } }),
    prisma.user.update({
      where: { id },
      data: {
        name: "Conta excluída",
        email: `excluido-${id}@invalid.local`,
        passwordHash: null,
        googleId: null,
        avatarUrl: null,
        // Só o ano de nascimento fica, para a distribuição por faixa etária.
        birthDate: user.birthDate ? new Date(Date.UTC(user.birthDate.getUTCFullYear(), 0, 1)) : null,
        status: "DELETED",
        deletedAt: new Date(),
      },
    }),
  ]);
  await revokeAllRefreshTokens(id);
}
