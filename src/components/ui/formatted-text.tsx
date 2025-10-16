interface FormattedTextProps {
  text: string;
  className?: string;
}

export function FormattedText({ text, className }: FormattedTextProps) {
  const parts = text.split(/(\*\*.*?\*\*)/);
  
  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          const boldText = part.slice(2, -2);
          return <strong key={index}>{boldText}</strong>;
        }
        return part;
      })}
    </span>
  );
}