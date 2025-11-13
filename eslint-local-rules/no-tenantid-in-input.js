/**
 * ESLint Rule: no-tenantid-in-input
 *
 * Prevents tenantId from being added to tRPC input schemas (except tenant.ts).
 * This is a critical security rule to prevent tenant data leakage.
 *
 * ✅ Correct pattern:
 * ```typescript
 * someEndpoint: protectedProcedure
 *   .input(z.object({ employeeId: z.string() }))
 *   .query(async ({ ctx }) => {
 *     const tenantId = ctx.user.tenantId;
 *   })
 * ```
 *
 * ❌ Violations:
 * ```typescript
 * badEndpoint: publicProcedure
 *   .input(z.object({ tenantId: z.string() }))  // ❌ TENANT LEAK
 * ```
 */

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow tenantId in tRPC input schemas (except tenant.ts)',
      category: 'Security',
      recommended: true,
    },
    messages: {
      noTenantIdInInput:
        '🔒 SECURITY: Never accept `tenantId` in tRPC input schemas. Use `ctx.user.tenantId` instead. ' +
        'Only `server/routers/tenant.ts` is exempt (for switchTenant/addUserToTenant/removeUserFromTenant).',
    },
    schema: [],
  },

  create(context) {
    const filename = context.getFilename();

    // Skip tenant.ts - it legitimately needs tenantId for admin operations
    if (filename.includes('server/routers/tenant.ts')) {
      return {};
    }

    // Only check files in server/routers/
    if (!filename.includes('server/routers/')) {
      return {};
    }

    return {
      // Match: tenantId: z.string() or tenantId: z.string().uuid()
      Property(node) {
        // Check if this is a property named "tenantId"
        if (
          node.key &&
          node.key.type === 'Identifier' &&
          node.key.name === 'tenantId'
        ) {
          // Check if the value is a Zod schema (z.string(), z.string().uuid(), etc.)
          if (
            node.value &&
            node.value.type === 'CallExpression' &&
            node.value.callee
          ) {
            const callee = node.value.callee;

            // Match z.string() or z.string().uuid() or z.string().uuid()
            const isZodSchema =
              (callee.type === 'MemberExpression' &&
               callee.object.name === 'z' &&
               callee.property.name === 'string') ||
              (callee.type === 'MemberExpression' &&
               callee.object.type === 'CallExpression' &&
               callee.object.callee.type === 'MemberExpression' &&
               callee.object.callee.object.name === 'z');

            if (isZodSchema) {
              context.report({
                node: node.key,
                messageId: 'noTenantIdInInput',
              });
            }
          }
        }
      },
    };
  },
};
