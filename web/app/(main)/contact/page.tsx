import { ContactForm } from "@/components/home/ContactForm";

export const metadata = {
  title: "문의 — WorldDeveloper",
  description: "제품·공고·제휴 관련 문의를 남겨주세요. 메일로 회신드려요.",
};

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <header className="space-y-2">
        <p className="text-body-sm font-semibold text-primary">문의</p>
        <h1 className="text-h1">궁금한 점이 있으신가요?</h1>
        <p className="text-muted-foreground">
          제품·공고·제휴 관련 문의를 남겨주세요. 메일로 회신드려요.
        </p>
      </header>
      <ContactForm />
    </div>
  );
}
