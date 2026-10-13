"use client";

import { Button } from "@workspace/ui/components/button";
import { getCookie } from "@workspace/ui/lib/cookies";
import {
  postCommonSendCode as sendEmailCode,
  postCommonSendSmsCode as sendSmsCode,
} from "@workspace/ui/services/common/common";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useGlobalStore } from "@/stores/global";

interface SendCodeProps {
  type: "email" | "phone";
  disabled?: boolean;
  onChallengeUsed?: () => void;
  params: {
    email?: string;
    type?: 1 | 2;
    telephone_area_code?: string;
    telephone?: string;
    cf_token?: string | null;
  };
}

export default function SendCode({
  type,
  params,
  disabled,
  onChallengeUsed,
}: SendCodeProps) {
  const { t } = useTranslation("auth");
  const { common } = useGlobalStore();
  const { verify_code_interval } = common.verify_code;
  const [endTime, setEndTime] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [loading, setLoading] = useState(false);
  const pending = useRef(false);
  const storageKey = `verify_code_${type}_${params.type}`;
  const requiresChallenge =
    params.type === 1 &&
    !getCookie("Authorization") &&
    common.verify.enable_register_verify &&
    Boolean(common.verify.turnstile_site_key);
  const unavailable =
    disabled ||
    loading ||
    seconds > 0 ||
    !params.type ||
    (requiresChallenge && !params.cf_token) ||
    (type === "email"
      ? !params.email
      : !(params.telephone && params.telephone_area_code) ||
        /[*•]/.test(params.telephone));

  useEffect(() => {
    const deadline = Number(localStorage.getItem(storageKey));
    const next =
      Number.isFinite(deadline) && deadline > Date.now() ? deadline : 0;
    setEndTime(next);
    setSeconds(next ? Math.ceil((next - Date.now()) / 1000) : 0);
    if (!next) localStorage.removeItem(storageKey);
  }, [storageKey]);

  useEffect(() => {
    if (!endTime) return;
    const update = () => {
      const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
      setSeconds(remaining);
      if (!remaining) setEndTime(0);
    };
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [endTime]);

  const send = async () => {
    if (pending.current || unavailable || !params.type) return;
    pending.current = true;
    setLoading(true);
    // Snapshot the purpose so a completed request cannot disable a new form.
    const key = storageKey;
    try {
      const challenge = requiresChallenge
        ? { cf_token: params.cf_token || undefined }
        : {};
      if (type === "email") {
        await sendEmailCode({
          email: params.email as string,
          type: params.type,
          ...challenge,
        });
      } else {
        await sendSmsCode({
          telephone: params.telephone as string,
          telephone_area_code: params.telephone_area_code as string,
          type: params.type,
          ...challenge,
        });
      }
      localStorage.setItem(
        key,
        String(Date.now() + verify_code_interval * 1000)
      );
    } catch {
      // No countdown on failure; the request layer displays the error.
    } finally {
      // Turnstile tokens are single use, including unsuccessful verification attempts.
      if (requiresChallenge) onChallengeUsed?.();
      pending.current = false;
      setLoading(false);
    }
  };

  useEffect(() => {
    if (loading) return;
    const deadline = Number(localStorage.getItem(storageKey));
    const next =
      Number.isFinite(deadline) && deadline > Date.now() ? deadline : 0;
    setEndTime(next);
    setSeconds(next ? Math.ceil((next - Date.now()) / 1000) : 0);
  }, [loading, storageKey]);

  return (
    <Button
      aria-busy={loading}
      disabled={Boolean(unavailable)}
      onClick={send}
      type="button"
    >
      {loading
        ? t("sending", "Sending...")
        : seconds > 0
          ? `${seconds}s`
          : t("get", "Get Code")}
    </Button>
  );
}
