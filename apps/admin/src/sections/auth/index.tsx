"use client";

import { Link, useNavigate } from "@tanstack/react-router";
import { LanguageSwitch } from "@workspace/ui/composed/language-switch";
import { DotLottieReact } from "@workspace/ui/composed/lottie";
import { ThemeSwitch } from "@workspace/ui/composed/theme-switch";
import { useReducedMotion } from "@workspace/ui/hooks/use-reduced-motion";
import { useEffect } from "react";
import { useGlobalStore } from "@/stores/global";
import EmailAuthForm from "./email/auth-form";

export default function Auth() {
  const { common, user } = useGlobalStore();
  const reducedMotion = useReducedMotion();
  const { site } = common;

  const navigate = useNavigate();
  useEffect(() => {
    if (user) {
      navigate({ to: "/dashboard" });
    }
  }, [navigate, user]);

  return (
    <main className="flex min-h-svh items-center bg-muted/50">
      <div className="flex size-full flex-auto flex-col justify-center lg:flex-row">
        <div className="flex lg:w-1/2 lg:flex-auto">
          <div className="flex w-full flex-col items-center justify-center px-5 py-4 md:px-14 lg:py-14">
            <Link className="mb-0 flex flex-col items-center lg:mb-12" to="/">
              <img
                alt="logo"
                height={48}
                src={site.site_logo || "/favicon.svg"}
                width={48}
              />
              <span className="font-semibold text-2xl">{site.site_name}</span>
            </Link>
            <DotLottieReact
              autoplay={!reducedMotion}
              className="mx-auto hidden w-full lg:block"
              loop={!reducedMotion}
              src="./assets/lotties/login.json"
            />
            <p className="hidden w-[275px] text-center md:w-1/2 lg:block xl:w-[500px]">
              {site.site_desc}
            </p>
          </div>
        </div>
        <div className="flex w-full flex-initial justify-center p-5 sm:p-8 lg:w-1/2 lg:flex-auto lg:justify-end">
          <div className="flex w-full max-w-[600px] flex-col items-center rounded-2xl lg:flex-auto lg:bg-background lg:p-10 lg:shadow">
            <div className="flex w-full max-w-[400px] flex-col items-stretch justify-center lg:h-full">
              <div className="flex flex-col justify-center pb-14 lg:flex-auto lg:pb-20">
                <EmailAuthForm />
              </div>
              <div className="flex items-center justify-end">
                {/* <div className='text-primary flex gap-5 text-sm font-semibold'>
                  <Link href='/tos'>{t('tos')}</Link>
                </div> */}
                <div className="flex items-center gap-5">
                  <LanguageSwitch />
                  <ThemeSwitch />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
