export type CharacterConfig = {
  id: string;
  name: string;
  role: string;
  firstPerson: string;
  userCallName: string;
  tone: string;
  speakingStyle: string[];
  forbiddenStyle: string[];
  greeting: string;
  fallbackMessage: string;
  avatar: {
    enabled: boolean;
    shape: "circle" | "rounded";
    placeholderText: string;
  };
};
