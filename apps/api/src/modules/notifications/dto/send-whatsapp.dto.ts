export class SendWhatsappDto {
  to: string;
  template: string;
  variables?: Record<string, unknown>;
}
