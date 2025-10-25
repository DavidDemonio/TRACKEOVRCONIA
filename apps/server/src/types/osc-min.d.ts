declare module 'osc-min' {
  export interface OscArgument {
    type: string;
    value: unknown;
  }

  export interface OscMessage {
    address: string;
    args?: OscArgument[] | unknown[];
  }

  export function toBuffer(message: OscMessage): Buffer;
}
