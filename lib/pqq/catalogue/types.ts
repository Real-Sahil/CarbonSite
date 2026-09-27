/** A questionnaire: its question references mapped to answer topics. */
export type QuestionSet = {
  id: string;
  name: string;
  issuer: string;
  version?: string;
  sourceUrl?: string;
  note?: string;
  /** `text` only for the organisation's own imported questionnaires; published sets carry references only. */
  questions: Array<{ ref: string; topicKey: string; text?: string }>;
};
