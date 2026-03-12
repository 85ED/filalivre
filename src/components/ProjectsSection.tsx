import { motion } from 'framer-motion';
import { BookOpen, FileText, Settings, Code2, ArrowRight } from 'lucide-react';

interface Project {
  icon: React.ReactNode;
  title: string;
  description: string;
  category: string;
}

const projects: Project[] = [
  {
    icon: <BookOpen className="w-8 h-8" />,
    title: 'Guia de Corrida',
    description: 'Aplicação mobile para corredores rastrearem e melhorarem seu desempenho em treinos.',
    category: 'Mobile App',
  },
  {
    icon: <FileText className="w-8 h-8" />,
    title: 'FilaLivre',
    description: 'Sistema de gestão de filas inteligente para atendimento presencial com fila virtual.',
    category: 'SaaS Platform',
  },
  {
    icon: <Settings className="w-8 h-8" />,
    title: 'Acesso4',
    description: 'Plataforma de gestão de acesso com controle de permissões e auditoria completa.',
    category: 'Enterprise Software',
  },
  {
    icon: <Code2 className="w-8 h-8" />,
    title: 'Soluções Customizadas',
    description: 'Aplicações web sob medida desenvolvidas para resolver desafios únicos de cada negócio.',
    category: 'Desenvolvimento',
  },
];

export function ProjectsSection() {
  return (
    <section className="py-24 bg-neutral-50" aria-labelledby="projects-title">
      <div className="max-w-6xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          {/* Título */}
          <div className="text-center mb-16">
            <h2 id="projects-title" className="text-4xl sm:text-5xl font-bold text-neutral-900 mb-4">
              Experiência em produtos digitais
            </h2>
            <p className="text-lg text-neutral-600 max-w-2xl mx-auto">
              Soluções desenvolvidas para resolver desafios reais em diferentes setores
            </p>
          </div>

          {/* Grid de Projetos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {projects.map((project, index) => (
              <motion.div
                key={project.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="group"
              >
                <div className="h-full bg-white rounded-2xl p-8 shadow-sm hover:shadow-lg transition-shadow border border-neutral-200">
                  {/* Ícone */}
                  <div className="w-12 h-12 bg-neutral-100 rounded-xl flex items-center justify-center text-neutral-900 mb-4 group-hover:bg-neutral-900 group-hover:text-white transition-colors">
                    {project.icon}
                  </div>

                  {/* Categoria Badge */}
                  <div className="mb-3">
                    <span className="inline-block px-2 py-1 rounded-full text-xs font-medium bg-neutral-100 text-neutral-700">
                      {project.category}
                    </span>
                  </div>

                  {/* Título */}
                  <h3 className="text-xl font-bold text-neutral-900 mb-2">{project.title}</h3>

                  {/* Descrição */}
                  <p className="text-neutral-600 leading-relaxed mb-6">{project.description}</p>

                  {/* Link */}
                  <div className="flex items-center text-neutral-900 font-semibold group-hover:translate-x-1 transition-transform">
                    Saiba mais
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* CTA */}
        </motion.div>
      </div>
    </section>
  );
}
