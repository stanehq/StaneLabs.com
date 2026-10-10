'use client';
import { useEffect, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Icon } from './components/Icon';
import LiquidField from './components/LiquidField';
import Atmosphere from './components/Atmosphere';
import { Button } from './components/ui/button';
import { Input, Textarea } from './components/ui/input';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from './components/ui/accordion';
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription } from './components/ui/dialog';
import config from '../project-config.json';
const contactApiUrl = process.env.NEXT_PUBLIC_CONTACT_API_URL || '';

const services = [
  { id: 'cyber', number: '01', title: 'Ciberseguridad', short: 'Sistemas', icon: 'shield' as const,
    headline: 'Una defensa que empieza por entender.',
    summary: 'Identifica tu exposición y convierte los riesgos en decisiones concretas para proteger tu infraestructura.',
    details: [['Superficie de ataque', 'Activos, accesos y configuraciones que necesitan atención.'], ['Seguridad por diseño', 'Privilegio mínimo y controles ajustados a tu entorno.'], ['Preparación ante incidentes', 'Prioridades y pasos de respuesta definidos de antemano.']],
    deliverable: 'Mapa de exposición', items: ['Activos y puntos de acceso', 'Riesgos ordenados por impacto', 'Plan de medidas prioritarias'] },
  { id: 'opsec', number: '02', title: 'Seguridad operativa', short: 'Identidad', icon: 'eye-off' as const,
    headline: 'Tu identidad también necesita límites.',
    summary: 'Comprende qué revela tu huella digital y separa identidades, comunicaciones y operaciones sensibles.',
    details: [['Huella digital', 'Información expuesta y vínculos entre tus contextos.'], ['Compartimentación', 'Separación de accesos, identidades y comunicaciones.'], ['Prácticas operativas', 'Hábitos claros para trabajar con menor exposición.']],
    deliverable: 'Modelo de exposición', items: ['Contextos e identidades', 'Canales y límites de acceso', 'Prácticas de protección'] },
  { id: 'data', number: '03', title: 'Datos sensibles', short: 'Información', icon: 'lock' as const,
    headline: 'Control sobre lo que no puedes perder.',
    summary: 'Define qué información es sensible, quién debe acceder y cómo protegerla durante todo su ciclo de vida.',
    details: [['Clasificación', 'Datos sensibles, ubicación y necesidades de protección.'], ['Control de acceso', 'Permisos proporcionados y revisión de su ciclo de vida.'], ['Ciclo de vida', 'Minimización, cifrado, conservación y eliminación.']],
    deliverable: 'Plan de protección', items: ['Inventario de información', 'Criterios de acceso', 'Medidas por ciclo de vida'] },
];
const workflowSteps = [
  ['Contexto', 'Acordamos qué proteger, el alcance y los límites del trabajo.'],
  ['Análisis', 'Identificamos la exposición y priorizamos el impacto.'],
  ['Plan', 'Definimos medidas claras, responsables y próximos pasos.'],
];
const questions = [
  ['¿Cómo empieza una colaboración?', 'Con una conversación sobre tu contexto. Después se acuerdan el alcance y las condiciones antes de intercambiar información sensible.'],
  ['¿Cómo se maneja la información sensible?', 'En el primer contacto comparte solo una descripción general. El canal, los accesos y las condiciones de intercambio se acuerdan para cada proyecto.'],
  ['¿Cómo comunico una vulnerabilidad?', 'Escribe a security@stanelabs.com con la URL afectada, una descripción y pasos mínimos para reproducirla.'],
];
const sections = [
  { id: 'especialidades', label: 'Especialidades' },
  { id: 'enfoque', label: 'Cómo trabajamos' },
  { id: 'entregables', label: 'Qué recibirás' },
  { id: 'preguntas', label: 'Preguntas' },
];

function Brand() {
  return <a className="brand" href="/" aria-label="Stane, inicio"><img src="/brand/stane-mark.svg" className="brand-logo" width="40" height="40" alt="" /><span className="brand-wordmark">Stane<span className="brand-period">.</span></span></a>;
}

function ContactDialog({ children, service }: { children: React.ReactNode; service?: string }) {
  const [draft, setDraft] = useState('');
  const [open, setOpen] = useState(false);
  const [apiReady, setApiReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (!open || !contactApiUrl) return;
    const controller = new AbortController();
    fetch(`${contactApiUrl}/contact/status`, { signal: controller.signal }).then(response => response.ok ? response.json() : null).then(data => setApiReady(data?.configured === true)).catch(() => setApiReady(false));
    return () => controller.abort();
  }, [open]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const topic = String(values.get('topic') || 'Consulta inicial');
    if (apiReady) {
      setPending(true); setNotice('');
      try {
        const response = await fetch(`${contactApiUrl}/contact`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: values.get('name'), email: values.get('email'), topic, message: values.get('message'), website: values.get('website') || '' }), signal: AbortSignal.timeout(15000) });
        const result = await response.json();
        if (!response.ok || result.status !== 'sent') throw new Error('send-failed');
        setNotice('Tu consulta se ha entregado al servidor de correo. Conserva una copia de tu mensaje si necesitas hacer seguimiento.');
      } catch {
        setNotice('No se pudo confirmar el envío. Puedes escribir directamente a security@stanelabs.com.');
      } finally { setPending(false); }
      return;
    }
    const body = `Nombre: ${values.get('name')}\nCorreo de contacto: ${values.get('email')}\nÁrea: ${topic}\n\n${values.get('message')}\n\nEnviado desde el sitio de Stane.`;
    const url = `mailto:${config.contactEmail}?subject=${encodeURIComponent(`Stane — ${topic}`)}&body=${encodeURIComponent(body)}`;
    setDraft(url);
    window.location.href = url;
  }
  return <Dialog open={open} onOpenChange={value => { setOpen(value); if (!value) { setDraft(''); setNotice(''); } }}>
    <DialogTrigger asChild>{children}</DialogTrigger>
    <DialogContent><p className="section-label">PRIMER CONTACTO</p><DialogTitle className="dialog-heading">Hablemos de lo que importa.</DialogTitle><DialogDescription className="dialog-description">Cuéntanos tu contexto. Comparte solo información general; acordaremos un canal para cualquier detalle sensible.</DialogDescription>
      <form className="contact-form" onSubmit={submit}>
        <input name="website" type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" className="honeypot" />
        <div className="form-grid"><label className="field"><span className="field-label">Tu nombre</span><Input name="name" placeholder="Nombre y apellidos" autoComplete="name" required maxLength={100} /></label><label className="field"><span className="field-label">Correo de contacto</span><Input name="email" type="email" placeholder="tu@empresa.com" autoComplete="email" required maxLength={180} /></label></div>
        <label className="field"><span className="field-label">¿Qué necesitas proteger?</span><select name="topic" defaultValue={service || 'Consulta inicial'} className="native-select"><option>Consulta inicial</option><option>Ciberseguridad</option><option>Seguridad operativa</option><option>Datos sensibles</option></select></label>
        <label className="field"><span className="field-label">Un poco de contexto</span><Textarea name="message" placeholder="Describe brevemente tu necesidad. No incluyas contraseñas, claves ni datos personales de terceros." required maxLength={2000} rows={4} /></label>
        <p className="form-note"><Icon name="lock" size={16} />{apiReady ? 'Tu consulta se enviará por correo a Stane. No incluyas información sensible.' : 'Este formulario prepara un borrador en tu aplicación de correo. No guarda tus datos ni envía mensajes automáticamente.'}</p>
        <Button type="submit" className="form-action" disabled={pending}>{pending ? 'Enviando…' : apiReady ? 'Enviar consulta' : 'Preparar correo'}<Icon name="arrow-up-right" size={20} /></Button>
        {notice && <div className="form-result" role="status">{notice}</div>}
        {draft && <div className="form-result" role="status">Tu borrador está listo. Revísalo y envíalo desde tu aplicación de correo. <a href={draft}>Abrir de nuevo el borrador<Icon name="external-link" size={16} /></a></div>}
        <p className="form-note">Al escribirnos, puedes consultar cómo se trata la información en la <a href="/privacy">nota de privacidad</a>.</p>
      </form>
    </DialogContent>
  </Dialog>;
}

function Header({ home }: { home: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState('');
  useEffect(() => {
    function scroll() { setScrolled(window.scrollY > 16); }
    scroll(); window.addEventListener('scroll', scroll, { passive: true });
    const observer = new IntersectionObserver(entries => { for (const entry of entries) if (entry.isIntersecting) setActive(entry.target.id); }, { rootMargin: '-25% 0px -55% 0px' });
    if (home) document.querySelectorAll('main section[id]').forEach(el => observer.observe(el));
    return () => { window.removeEventListener('scroll', scroll); observer.disconnect(); };
  }, [home]);
  const links = [['servicios', 'Especialidades'], ['enfoque', 'Cómo trabajamos'], ['contacto', 'Contacto']];
  return <header className={`site-header ${scrolled ? 'scrolled' : ''}`}><div className="header-inner"><Brand /><nav className="desktop-nav" aria-label="Navegación principal">{links.map(([id, label]) => <a key={id} href={`${home ? '' : '/'}#${id}`} className={`nav-link ${active === id ? 'active' : ''}`}>{label}</a>)}</nav><div className="header-end"><span className="locale" lang="es">ES</span><ContactDialog><Button size="sm" className="header-contact">Hablemos<Icon name="arrow-up-right" size={16} /></Button></ContactDialog><Button className="menu-button" size="icon" aria-expanded={menuOpen} aria-controls="mobile-menu" aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'} onClick={() => setMenuOpen(!menuOpen)}><Icon name={menuOpen ? 'x' : 'menu'} /></Button></div></div>{menuOpen && <nav id="mobile-menu" className="mobile-menu" aria-label="Navegación móvil">{links.map(([id, label]) => <a key={id} className="mobile-nav-link" href={`${home ? '' : '/'}#${id}`} onClick={() => setMenuOpen(false)}>{label}<Icon name="arrow-up-right" /></a>)}<a className="mobile-nav-link" href="/security" onClick={() => setMenuOpen(false)}>Seguridad<Icon name="arrow-up-right" /></a></nav>}</header>;
}

function Hero({ onSelectService }: { onSelectService: (id: string) => void }) {
  return <section className="hero-shell" aria-labelledby="hero-heading">
    <div className="container hero">
      <div className="hero-copy">
        <p className="eyebrow"><span className="eyebrow-dot" />ESTUDIO DE CIBERSEGURIDAD Y OPSEC</p>
        <h1 id="hero-heading" className="hero-title"><span>Tus datos.</span><span>Tu identidad.</span><span className="hero-title-accent">Tu control.</span></h1>
        <p className="hero-description">Protegemos lo que importa.<br />Ciberseguridad, seguridad operativa y datos sensibles, con criterio.</p>
        <div className="hero-actions"><ContactDialog><Button>Hablemos de seguridad<Icon name="arrow-up-right" /></Button></ContactDialog><a className="text-link" href="#servicios">Explorar especialidades<Icon name="arrow-down" size={16} /></a></div>
      </div>
      <div className="hero-art" aria-hidden="true"><LiquidField /></div>
    </div>
    <div className="container expertise-strip">{services.map(service => <a href={'#' + service.id} key={service.id} onClick={() => onSelectService(service.id)}><Icon name={service.icon} size={20} /><span>{service.title}</span><Icon name="arrow-up-right" size={16} /></a>)}</div>
  </section>;
}

function tabKey(event: KeyboardEvent<HTMLElement>, ids: string[], selected: string, select: (id: string) => void) {
  const current = ids.indexOf(selected);
  const next = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? (current + 1) % ids.length : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? (current - 1 + ids.length) % ids.length : event.key === 'Home' ? 0 : event.key === 'End' ? ids.length - 1 : -1;
  if (next === -1) return;
  event.preventDefault(); select(ids[next]);
  const tabs = event.currentTarget.parentElement?.querySelectorAll<HTMLElement>('[role="tab"]');
  tabs?.[next]?.focus();
}

function Deliverable({ service }: { service: typeof services[number] }) {
  return <div className="deliverable-preview" aria-label={'Ejemplo ilustrativo: ' + service.deliverable}>
    <div className="preview-heading"><img src="/brand/stane-mark.svg" width="24" height="24" alt="" /><span>Ejemplo de entregable</span><Icon name="file-text" size={16} /></div>
    <div className="preview-document"><p className="document-category">{service.title}</p><h3>{service.deliverable}</h3><div className="document-visual" aria-hidden="true"><span /><span /><span /><i /><i /><i /></div><ol>{service.items.map((item, index) => <li key={item}><span>{String(index + 1).padStart(2, '0')}</span>{item}</li>)}</ol><div className="document-footer"><span>Alcance · Prioridades · Próximos pasos</span><Icon name="arrow-up-right" size={16} /></div></div>
    <p className="preview-note">Formato ilustrativo. El contenido se acuerda según el alcance.</p>
  </div>;
}

function Home() {
  const [section, setSection] = useState('especialidades');
  const [serviceId, setServiceId] = useState('cyber');
  const selected = services.find(service => service.id === serviceId) || services[0];
  useEffect(() => {
    function syncHash() {
      const hash = window.location.hash.slice(1);
      if (services.some(service => service.id === hash)) { setServiceId(hash); setSection('especialidades'); document.getElementById('servicios')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' }); }
      else if (sections.some(item => item.id === hash)) setSection(hash);
      else if (hash === 'servicios') setSection('especialidades');
    }
    syncHash(); window.addEventListener('hashchange', syncHash);
    return () => window.removeEventListener('hashchange', syncHash);
  }, []);
  function selectService(id: string) { setServiceId(id); setSection('especialidades'); }
  return <><Hero onSelectService={selectService} />
    <section id="servicios" className="expertise-section container" aria-labelledby="expertise-heading">
      <div className="expertise-heading"><div><p className="section-label">SEGURIDAD CON CRITERIO</p><h2 id="expertise-heading">Tres perspectivas.<br /><span>Una misma defensa.</span></h2></div><p>Sistemas, personas e información.<br />Protección conectada con tu realidad.</p></div>
      <span id="enfoque" className="section-anchor" aria-hidden="true" />
      <div className="section-tabs" role="tablist" aria-label="Explorar Stane">{sections.map(item => <a key={item.id} href={'#' + (item.id === 'especialidades' ? 'servicios' : item.id)} role="tab" id={'tab-' + item.id} aria-selected={section === item.id} aria-controls={'panel-' + item.id} tabIndex={section === item.id ? 0 : -1} onClick={event => { event.preventDefault(); setSection(item.id); }} onKeyDown={event => tabKey(event, sections.map(s => s.id), section, setSection)}>{item.label}<Icon name="arrow-up-right" size={16} /></a>)}</div>
      <div id="panel-especialidades" className="workspace-panel" role="tabpanel" aria-labelledby="tab-especialidades" hidden={section !== 'especialidades'} tabIndex={0}>
        <div className="specialty-layout"><div className="specialty-tabs" role="tablist" aria-label="Áreas de protección" aria-orientation="vertical">{services.map(service => <a key={service.id} id={'service-tab-' + service.id} role="tab" href={'#' + service.id} aria-selected={serviceId === service.id} aria-controls={'service-panel-' + service.id} tabIndex={serviceId === service.id ? 0 : -1} onClick={event => { event.preventDefault(); setServiceId(service.id); }} onKeyDown={event => tabKey(event, services.map(s => s.id), serviceId, setServiceId)}><span className="specialty-icon"><Icon name={service.icon} size={24} /></span><span><small>{service.short}</small>{service.title}</span><Icon name="chevron-right" size={16} /></a>)}</div>
          {services.map(service => <div key={service.id} id={'service-panel-' + service.id} className="specialty-content" role="tabpanel" aria-labelledby={'service-tab-' + service.id} hidden={serviceId !== service.id} tabIndex={0}><div className="specialty-copy"><p className="section-label">{service.number} / {service.title}</p><h3>{service.headline}</h3><p className="specialty-summary">{service.summary}</p><ul className="specialty-points">{service.details.map(([title, text]) => <li key={title}><Icon name="check" size={16} /><div><h4>{title}</h4><p>{text}</p></div></li>)}</ul><ContactDialog service={service.title}><Button size="sm">Consultar sobre esta área<Icon name="arrow-up-right" size={16} /></Button></ContactDialog></div><Deliverable service={service} /></div>)}
        </div>
      </div>
      <div id="panel-enfoque" className="workspace-panel approach-panel" role="tabpanel" aria-labelledby="tab-enfoque" hidden={section !== 'enfoque'} tabIndex={0}>
        <div className="panel-intro"><p className="section-label">DEL CONTEXTO A LA ACCIÓN</p><h3>Primero entender.<br /><span>Después actuar.</span></h3><p>Un alcance claro. Decisiones proporcionadas. Cada medida responde a lo que necesitas proteger.</p></div>
        <div className="approach-steps">{workflowSteps.map(([title, text], i) => <div key={title}><span className="step-number">0{i + 1}</span><h4>{title}</h4><p>{text}</p><Icon name={i === 2 ? 'check' : 'arrow-down'} size={20} /></div>)}</div>
        <div className="scope-note"><Icon name="lock" size={20} /><p>Antes de compartir detalles sensibles, acordamos el canal, las personas con acceso y las condiciones del intercambio.</p></div>
      </div>
      <div id="panel-entregables" className="workspace-panel deliverables-panel" role="tabpanel" aria-labelledby="tab-entregables" hidden={section !== 'entregables'} tabIndex={0}>
        <div className="panel-intro"><p className="section-label">CLARIDAD PARA DECIDIR</p><h3>Un análisis útil.<br /><span>Un siguiente paso claro.</span></h3><p>El alcance se acuerda para cada proyecto. Estos ejemplos muestran cómo puede organizarse el resultado.</p><a className="text-link" href="#contacto">Definir mi alcance<Icon name="arrow-up-right" size={16} /></a></div><Deliverable service={selected} /><div className="delivery-list">{[['file-text', 'Diagnóstico', 'Qué está expuesto y por qué importa.'], ['sliders', 'Prioridades', 'Medidas ordenadas por riesgo y contexto.'], ['compass', 'Plan de acción', 'Pasos concretos para reducir la exposición.']].map(([icon, title, text]) => <div key={title}><Icon name={icon as 'file-text' | 'sliders' | 'compass'} size={24} /><h4>{title}</h4><p>{text}</p></div>)}</div>
      </div>
      <div id="panel-preguntas" className="workspace-panel questions-panel" role="tabpanel" aria-labelledby="tab-preguntas" hidden={section !== 'preguntas'} tabIndex={0}><div className="panel-intro"><p className="section-label">ANTES DEL PRIMER PASO</p><h3>Una conversación<br /><span>con confianza.</span></h3><p>Sin credenciales ni documentos sensibles en el primer contacto.</p></div><Accordion type="single" collapsible className="faq-list">{questions.map(([question, answer], i) => <AccordionItem value={'faq-' + i} key={question} className="faq-item"><AccordionTrigger className="faq-question">{question}</AccordionTrigger><AccordionContent>{answer}</AccordionContent></AccordionItem>)}</Accordion></div>
    </section>
    <section id="contacto" className="contact-section" aria-labelledby="contact-heading"><div className="container contact-layout"><div><p className="section-label">HABLEMOS</p><h2 id="contact-heading">Lo importante merece<br /><span>estar protegido.</span></h2></div><div className="contact-copy"><p>Cuéntanos qué necesitas proteger.<br />Empecemos por una conversación.</p><div className="contact-actions"><ContactDialog><Button>Iniciar conversación<Icon name="arrow-up-right" /></Button></ContactDialog><a className="text-link" href={'mailto:' + config.contactEmail}>{config.contactEmail}<Icon name="arrow-up-right" size={16} /></a></div></div></div></section>
  </>;
}

const pageContent: Record<string, {label: string; title: string; lead: string; sections: {title: string; content: React.ReactNode}[]}> = {
  '/security': {label: '', title: '', lead: '', sections: []},
  '/privacy': {label: '', title: '', lead: '', sections: []},
  '/tos': {label: '', title: '', lead: '', sections: []},
  '/purchase': {label: '', title: '', lead: '', sections: []},
};
function LegalPage({ path }: {path: string}) {
  const data = pageContent[path];
  if (!data) return <div className="container legal-page"><h1>Página no encontrada.</h1><a href="/">Volver al inicio</a></div>;
  return <article className="container legal-page"><a className="back-link" href="/"><Icon name="arrow-left" size={16} />Volver a Stane</a><div className="legal-header"><p className="section-label">{data.label}</p><h1>{data.title}</h1><p>{data.lead}</p><span className="legal-meta">Última actualización: 9 de octubre de 2026</span></div><div className="legal-content">{data.sections.map(section => <section className="legal-section" key={section.title}><h2>{section.title}</h2><div>{section.content}</div></section>)}</div></article>;
}
function Footer() {
  return <footer className="footer"><div className="container footer-inner"><Brand /><div className="footer-links"><a href="/security">Seguridad</a><a href="/privacy">Privacidad</a><a href="/tos">Términos</a><a href="/purchase">Compras</a><a href="/.well-known/security.txt">security.txt<Icon name="arrow-up-right" size={16} /></a></div><span className="copyright">© 2026 Stane</span></div></footer>;
}
export default function App({ path = '/' }: { path?: string }) {
  const normalized = path.replace(/\/$/, '') || '/';
  return <div className="site-frame">{normalized === '/' && <Atmosphere />}<a href="#main" className="skip-link">Saltar al contenido</a><div id="top" /><Header home={normalized === '/'} /><main id="main">{normalized === '/' ? <Home /> : <LegalPage path={normalized} />}</main><Footer /></div>;
}
