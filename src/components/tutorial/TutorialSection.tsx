interface TutorialSectionProps {
  title: string;
  children: React.ReactNode;
}

export function TutorialSection({ title, children }: TutorialSectionProps) {
  return (
    <section className="mb-10">
      <h2 className="text-lg font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-100">
        {title}
      </h2>
      <div>{children}</div>
    </section>
  );
}
