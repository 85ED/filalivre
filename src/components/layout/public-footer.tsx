export function PublicFooter() {
  return (
    <footer className="py-8 bg-neutral-900 text-white" role="contentinfo">
      <div className="max-w-7xl mx-auto px-4 text-center">
        <p className="text-lg mb-2">FilaLivre &copy; {new Date().getFullYear()}</p>
        <p className="text-neutral-400">Sistema de gestão de filas para atendimento presencial</p>
      </div>
    </footer>
  );
}
