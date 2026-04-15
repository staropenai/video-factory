-- ================================================================
-- Supabase RLS 修复脚本
-- 项目: fhnupnljukxfsnolutvo (staropenai's Project)
-- 日期: 2026-04-16
--
-- 修复内容:
--   1. 对 3 个表启用 RLS (intent_samples, source_registry, faq_items)
--   2. 添加默认拒绝策略 + 认证用户读取策略
--   3. 修复 Security Definer View 问题
--
-- 执行方式: Supabase Dashboard → SQL Editor → 粘贴 → Run
-- ================================================================

-- ─── STEP 1: 对 3 个裸表启用 RLS ─────────────────────────────────

ALTER TABLE public.intent_samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faq_items ENABLE ROW LEVEL SECURITY;

-- ─── STEP 2: 添加策略 — 认证用户可读，仅 service_role 可写 ──────

-- intent_samples
CREATE POLICY "authenticated_read_intent_samples"
  ON public.intent_samples
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "service_role_all_intent_samples"
  ON public.intent_samples
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- source_registry
CREATE POLICY "authenticated_read_source_registry"
  ON public.source_registry
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "service_role_all_source_registry"
  ON public.source_registry
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- faq_items
CREATE POLICY "authenticated_read_faq_items"
  ON public.faq_items
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "service_role_all_faq_items"
  ON public.faq_items
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ─── STEP 3: 修复 Security Definer Views ────────────────────────
-- 将所有 SECURITY DEFINER 视图改为 SECURITY INVOKER
-- 这样视图会遵守调用者的 RLS 策略，而不是绕过它们

ALTER VIEW public.v_phase1_faq_seed_summary SET (security_invoker = on);
ALTER VIEW public.v_phase1_faq_candidates SET (security_invoker = on);
ALTER VIEW public.v_phase1_boundary_tool_candidates SET (security_invoker = on);
ALTER VIEW public.v_router_decision_stats SET (security_invoker = on);
ALTER VIEW public.v_phase1_regression_summary SET (security_invoker = on);
ALTER VIEW public.v_faq_source_completeness SET (security_invoker = on);
ALTER VIEW public.v_phase1_source_registry_summary SET (security_invoker = on);
ALTER VIEW public.v_phase1_human_candidates SET (security_invoker = on);
ALTER VIEW public.v_phase1_rules_candidates SET (security_invoker = on);
ALTER VIEW public.v_escalation_summary SET (security_invoker = on);
ALTER VIEW public.v_regression_pass_rate SET (security_invoker = on);
ALTER VIEW public.v_phase1_dynamic_risk_candidates SET (security_invoker = on);

-- ─── STEP 4: 验证 ───────────────────────────────────────────────
-- 运行后检查：所有表应显示 RLS enabled

SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('intent_samples', 'source_registry', 'faq_items')
ORDER BY tablename;
