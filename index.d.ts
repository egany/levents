import {
  Request as ExpressRequest,
  Response as ExpressResponse,
  NextFunction as ExpressNextFunction,
} from "express";

export {};

declare global {
  namespace NodeJS {
    interface Process {
      appSettings: Levents.Core.AppSettings;
    }
  }

  namespace Levents {
    namespace Errors {
      interface AppError {
        code: number;
        type: string;
        message: string;
        viMessage?: string;
        fields: string[];
        responseCode: number;
        errors: AppError[];
        data: any;
        __name__: string;
      }

      interface AppErrorParams {
        code?: number;
        type?: string;
        message?: string;
        viMessage?: string;
        fields?: string[];
        errors?: AppError[];
        data: any;
      }

      type IsInstanceParams = AppError;

      type IsInstanceResult = boolean;
    }

    namespace Core {
      interface Result<T, M = Meta> {
        data: T;
        meta: M;
        errors: Errors.AppError[];
      }

      interface AppSettings {
        brand: string;
        port: number;

        // Logger
        logLevel: string;

        // Shopify
        shopifyHostname: string;
        shopifyAccessToken: string;
        shopifyClientKey: string;
        shopifyClientSecret: string;

        // Sendgrid
        sendgridApiKey: string;
        sendgridMailer: string;

        // VMG
        vmgBrandname: string;
        vmgBrandsmsApiUrl: string;
        vmgBrandsmsToken: string;

        // OTP
        /**
         * 0: Off
         * 1: Send OTP and attach otp in the response
         * 2: Only attach otp in the response
         */
        otpTestMode: 0 | 1 | 2;
        otpMaxAttempts: number;
        otpMaxCreateAttempts: number;
        otpBlockedHour: number;
        otpExpires: number;

        mongoConnectionString: string;

        judgeMeUrl: string;
        judgeMePrivateToken: string;
        judgeMePublicToken: string;
      }

      interface Meta {
        otpAttempts?: number;
        otpCreateAttempts?: number;
        otpBlockedHour?: number;
        otpExpires?: number;
        otpMaxAttempts?: number;
        otpMaxCreateAttempts?: number;
        otpTestMode?: number;
        otpBlockUntil?: Date;
        responseCode: number;
        sessionId?: string;
      }
    }

    namespace Shopify {
      enum CustomerState {
        DECLINED = "DECLINED",
        DISABLED = "DISABLED",
        ENABLED = "ENABLED",
        INVITED = "INVITED",
      }

      interface Customer {
        displayName: string;
        email?: string;
        firstName?: string;
        id: string;
        lastName?: string;
        metafields?: Metafield[];
        phone?: string;
        state: CustomerState;
        verifiedEmail: boolean;
      }

      interface Metafield {
        id: string;
        key: string;
        namespace: string;
        type: string;
        value: string;
      }

      interface MetafieldSet extends Metafield {
        ownerId: string;
      }

      interface ReadOneCustomerParams {
        query: {
          email?: string;
          phone?: string;
          id?: string;
        };
        not?: string[];
      }

      interface CreateOneCustomerParams {
        email: string;
        phone: string;
        firstName?: string;
        lastName?: string;
        displayName?: string;
        metafields?: MetafieldSet[];
      }

      interface CreateOneCustomerResult extends Core.Result<Customer> {}

      interface ReadOneCustomerResult extends Core.Result<Customer> {}

      interface UpdateOneCustomerResult extends Core.Result<Customer> {}

      interface UpdateOneCustomerParams {
        id: string;
        email?: string;
        phone?: string;
        firstName?: string;
        lastName?: string;
        displayName?: string;
        metafields?: MetafieldSet[];
      }

      interface DeleteOneCustomerParams {
        id: string;
      }

      interface DeleteOneCustomerResult extends Core.Result<{ id: string }> {}

      interface GenerateAccountActivationUrlParams {
        id: string;
      }

      interface GenerateAccountActivationUrlResult
        extends Core.Result<{ accountActivationUrl: string }> {}

      interface DeleteOneMetafieldParams {
        id: string;
      }

      interface DeleteOneMetafieldResult
        extends Core.Result<{ deletedId: string }> {}
    }

    interface VerifyOTPParams {
      email: string;
      phone: string;
      OTP: string;
      verifyPhone: boolean;
      verifyEmail: boolean;
    }

    interface VerifyOTPResult extends Core.Result<{ verified: boolean }> {}

    interface GenerateOTPParams {
      email?: string;
      phone?: string;
    }

    interface GenerateOTPResult
      extends Core.Result<{
        email?: string;
        phone?: string;
        OTP: string;
      }> {}

    interface SendEmailOTPParams {
      email: string;
      OTP: string;
    }

    interface SendPhoneOTPParams {
      phone: string;
      OTP: string;
    }

    interface SendPhoneOTPResult {
      sendMessage: {
        to: string;
        telco: string;
        orderCode: string;
        packageCode: string;
        type: number;
        from: string;
        message: string;
        scheduled: string;
        requestId: string;
        useUnicode: 0 | 1 | 2;
        ext: {};
      };
      msgLength: number;
      mtCount: number;
      account: string;
      errorCode: string;
      errorMessage: string;
      referentId: string;
    }

    namespace Routes {
      interface RegisterAccountParams {
        email: string;
        phone: string;
        otp?: string;
        needOTPVerification?: boolean;
        gender?: string;
        otpPhone?: boolean;
        otpEmail?: boolean;
        sessionId?: string;
        [key: string]: any;
      }

      interface RegisterAccountResponse
        extends Core.Result<
          Shopify.Customer & {
            accountActivationUrl: string;
            sessionId?: string;
            needOTPVerification: boolean;
            otpPhone?: boolean;
            otpEmail?: boolean;
          }
        > {}

      interface RegisterAccountContext {
        result: RegisterAccountResponse;
        otpVerified: boolean;
        standardizedPhoneNumber?: string;
        customer?: Shopify.Customer;
      }

      interface RegisterAccountRequest
        extends Request<RegisterAccountContext, RegisterAccountParams> {}

      interface Request<C, B> extends ExpressRequest {
        context: C;
        body: B;
        session?: {
          sessionId: string;
          emailVerified?: boolean;
          phoneVerified?: boolean;
          phone?: string;
          email?: string;
          otpVerified?: boolean;
        };
      }

      interface Response extends ExpressResponse {}

      interface NextFunction extends ExpressNextFunction {}
    }
  }
}
