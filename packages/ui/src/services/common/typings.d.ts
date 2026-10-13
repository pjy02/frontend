declare namespace API {
  type Ads = {
    content: string;
    created_at: number;
    description: string;
    end_time: number;
    id: number;
    start_time: number;
    status: number;
    target_url: string;
    title: string;
    type: string;
    updated_at: number;
  };

  type AuthConfig = {
    device: DeviceAuthticateConfig;
    email: EmailAuthticateConfig;
    mobile: MobileAuthenticateConfig;
    register: PubilcRegisterConfig;
  };

  type CheckUserResponse = {
    exist: boolean;
  };

  type CheckVerificationCodeRequest = {
    account: string;
    code: string;
    method: "email" | "mobile";
    type: 1 | 2;
  };

  type CheckVerificationCodeRespone = {
    status: boolean;
  };

  type Currency = {
    currency_symbol: string;
    currency_unit: string;
  };

  type deleteNotifyPlatformTokenParams = {
    /** platform */
    platform: string;
    /** token */
    token: string;
  };

  type DeviceAuthticateConfig = {
    enable: boolean;
    enable_security: boolean;
    /** Requires authenticated device transport, not hardware attestation. */
    only_real_device: boolean;
    show_ads: boolean;
  };

  type DeviceLoginRequest = {
    cf_token?: string;
    identifier: string;
    invite?: string;
  };

  type DownloadLink = {
    android?: string;
    harmony?: string;
    ios?: string;
    linux?: string;
    mac?: string;
    windows?: string;
  };

  type EmailAuthticateConfig = {
    domain_suffix_list: string;
    enable: boolean;
    enable_domain_suffix: boolean;
    enable_verify: boolean;
  };

  type GetAdsResponse = {
    list: Ads[];
  };

  type getAuthCheckParams = {
    email: string;
  };

  type getAuthCheckTelephoneParams = {
    telephone: string;
    telephone_area_code: string;
  };

  type getCommonAdsParams = {
    device?: string;
    position?: string;
  };

  type GetGlobalConfigResponse = {
    auth: AuthConfig;
    currency: Currency;
    invite: InviteConfig;
    oauth_methods: string[];
    site: SiteConfig;
    subscribe: SubscribeConfig;
    verify: VeifyConfig;
    verify_code: PubilcVerifyCodeConfig;
    web_ad: boolean;
  };

  type getNotifyPlatformTokenParams = {
    /** platform */
    platform: string;
    /** token */
    token: string;
  };

  type GetStatResponse = {
    country: number;
    node: number;
    protocol: string[];
    user: number;
  };

  type GetSubscribeClientResponse = {
    list: SubscribeClient[];
    total: number;
  };

  type GetTosResponse = {
    tos_content: string;
  };

  type HeartbeatResponse = {
    message: string;
    status: boolean;
    timestamp: number;
  };

  type InviteConfig = {
    forced_invite: boolean;
    only_first_purchase: boolean;
    referral_percentage: number;
    withdrawal_method: string;
  };

  type LoginResponse = {
    /** ThirdPartyBindings lists the types of the third-party sign-in methods
(OAuth providers, Telegram) still bound to the account after a
password reset, so the client can show them: a binding made during a
compromise keeps signing in until its owner removes it. Empty for
every other sign-in. */
    third_party_bindings: string[];
    token: string;
  };

  type MobileAuthenticateConfig = {
    enable: boolean;
    enable_whitelist: boolean;
    whitelist: string[];
  };

  type OAthLoginRequest = {
    /** google, facebook, apple, telegram, github etc. */
    method: string;
    /** Nonce is an optional random value the client generates and keeps (for
example in session storage) for this sign-in; it is presented again on
the token exchange, so a sign-in another browser started cannot be
completed in this one. At least 16 random characters are recommended. */
    nonce?: string;
    redirect?: string;
  };

  type OAuthLoginGetTokenRequest = {
    callback: any;
    cf_token?: string;
    invite?: string;
    /** google, facebook, apple, telegram, github etc. */
    method: string;
    /** Nonce is the value the client sent when it started this sign-in; a
sign-in started with a nonce is completed only with the same one, and
one started without a nonce only without one. */
    nonce?: string;
  };

  type OAuthLoginResponse = {
    redirect: string;
  };

  type patchNotifyPlatformTokenParams = {
    /** platform */
    platform: string;
    /** token */
    token: string;
  };

  type postNotifyPlatformTokenParams = {
    /** platform */
    platform: string;
    /** token */
    token: string;
  };

  type PrivacyPolicyConfig = {
    privacy_policy: string;
  };

  type PubilcRegisterConfig = {
    enable_ip_register_limit: boolean;
    ip_register_limit: number;
    ip_register_limit_duration: number;
    stop_register: boolean;
  };

  type PubilcVerifyCodeConfig = {
    verify_code_interval: number;
  };

  type putNotifyPlatformTokenParams = {
    /** platform */
    platform: string;
    /** token */
    token: string;
  };

  type ResetPasswordRequest = {
    cf_token?: string;
    code?: string;
    email: string;
    identifier?: string;
    password: string;
  };

  type ResponseSuccessBean = {
    code: number;
    msg: string;
  };

  type SendCodeRequest = {
    /** CfToken is the Turnstile response an anonymous request for a
registration code (type 1) carries while registration verification is
on; other requests leave it empty. */
    cf_token?: string;
    email: string;
    type: 1 | 2;
  };

  type SendCodeResponse = {
    code: string;
    status: boolean;
  };

  type SendSmsCodeRequest = {
    /** CfToken is the Turnstile response an anonymous request for a
registration code (type 1) carries while registration verification is
on; other requests leave it empty. */
    cf_token?: string;
    telephone: string;
    telephone_area_code: string;
    type: 1 | 2;
  };

  type SiteConfig = {
    custom_data: string;
    custom_html: string;
    host: string;
    keywords: string;
    site_desc: string;
    site_logo: string;
    site_name: string;
  };

  type SubscribeClient = {
    description: string;
    download_link: DownloadLink;
    icon: string;
    id: number;
    is_default: boolean;
    name: string;
    scheme: string;
  };

  type SubscribeConfig = {
    pan_domain: boolean;
    profile_update_interval: number;
    profile_web_page_url: string;
    show_tutorial: boolean;
    single_model: boolean;
    subscribe_domain: string;
    subscribe_path: string;
    user_agent_limit: boolean;
    user_agent_list: string;
  };

  type TelephoneCheckUserResponse = {
    exist: boolean;
  };

  type TelephoneLoginRequest = {
    cf_token?: string;
    identifier?: string;
    password?: string;
    telephone: string;
    telephone_area_code: string;
    telephone_code?: string;
  };

  type TelephoneRegisterRequest = {
    cf_token?: string;
    code?: string;
    identifier?: string;
    invite?: string;
    password: string;
    telephone: string;
    telephone_area_code: string;
  };

  type TelephoneResetPasswordRequest = {
    cf_token?: string;
    code?: string;
    identifier?: string;
    password: string;
    telephone: string;
    telephone_area_code: string;
  };

  type UserLoginRequest = {
    cf_token?: string;
    email: string;
    identifier?: string;
    password: string;
  };

  type UserRegisterRequest = {
    cf_token?: string;
    code?: string;
    email: string;
    identifier?: string;
    invite?: string;
    password: string;
  };

  type VeifyConfig = {
    enable_login_verify: boolean;
    enable_register_verify: boolean;
    enable_reset_password_verify: boolean;
    turnstile_site_key: string;
  };
}
