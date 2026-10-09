'use client';
import { useEffect, useState, type FormEvent } from 'react';
import * as AccordionPrimitive from '@radix-ui/react-accordion';
import { Icon } from './components/Icon';
import LiquidField from './components/LiquidField';
import { Button } from './components/ui/button';
import { Input, Textarea } from './components/ui/input';
import { Card } from './components/ui/card';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from './components/ui/accordion';
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription } from './components/ui/dialog';
import config from '../project-config.json';
const contactApiUrl = process.env.NEXT_PUBLIC_CONTACT_API_URL || '';

const services = [
  { id: 'cyber', number: '01', title: 'Ciberseguridad', summary: 'Entender tu superficie de ataque. Reducir el riesgo antes de que se convierta en un incidente.', icon: 'shield' as const,
    details: [ ['Evaluación de exposición', 'Revisión de activos, configuraciones y puntos de acceso para identificar dónde concentrar la defensa.'], ['Seguridad por diseño', 'Criterios de endurecimiento, privilegio mínimo y segmentación adaptados al entorno.'], ['Preparación ante incidentes', 'Definición de prioridades, responsabilidades y pasos de respuesta antes de necesitarlos.'] ] },
  { id: 'opsec', number: '02', title: 'Seguridad operativa', summary: 'Lo que compartes también te define. Protege tu identidad, tus procesos y tu huella digital.', icon: 'eye-off' as const,
    details: [ ['Huella digital', 'Identificación de información expuesta que permite vincular personas, identidades y operaciones.'], ['Compartimentación', 'Separación de contextos, accesos y comunicaciones según su sensibilidad.'], ['Hábitos de protección', 'Prácticas claras para manejar información, trabajar y comunicarse con menor exposición.'] ] },
  { id: 'data', number: '03', title: 'Datos sensibles', summary: 'Tu información merece límites claros. Control sobre quién accede, cómo se usa y cuánto se conserva.', icon: 'lock' as const,
    details: [ ['Clasificación de información', 'Distinguir qué datos son sensibles, dónde residen y qué protección necesitan.'], ['Control de acceso', 'Definir permisos y revisar su ciclo de vida bajo el principio de mínimo privilegio.'], ['Ciclo de vida del dato', 'Criterios de minimización, cifrado, conservación y eliminación segura.'] ] },
];
const workflowSteps = [
  ['Escuchar', 'Tu contexto primero. Entendemos qué necesitas proteger y qué está en juego.'],
  ['Analizar', 'Identificamos la exposición y ordenamos los riesgos por su impacto real.'],
  ['Diseñar', 'Construimos un plan concreto, proporcionado y conectado con tu operación.'],
  ['Evolucionar', 'Revisamos las decisiones cuando cambian tu entorno y tus necesidades.'],
];
const questions = [
  ['¿En qué se diferencia OPSEC de la ciberseguridad?', 'La ciberseguridad se centra en sistemas, redes y datos. OPSEC observa también las personas, los hábitos y las señales que una operación deja expuestas. Ambas perspectivas se complementan para reducir el riesgo.'],
  ['¿Cómo empieza una colaboración?', 'Con una conversación sobre tu contexto y tus prioridades, sin compartir credenciales ni documentación sensible. A partir de ahí se acuerdan el alcance, los canales de comunicación y las condiciones del trabajo.'],
  ['¿Puedo consultar sobre un entorno especialmente sensible?', 'Sí. Describe únicamente la naturaleza general de tu necesidad. Antes de intercambiar archivos o detalles de infraestructura, acordaremos un canal y unas condiciones adecuadas.'],
  ['¿Cómo comunico una posible vulnerabilidad?', 'Escribe a security@stanelabs.com e incluye la URL afectada, una descripción y pasos mínimos de reproducción. Nuestra página de seguridad detalla las pautas de comunicación responsable.'],
];

function Brand() {
  return <a className="brand" href="/" aria-label="StaneLabs, inicio"><img src="/brand/stane-mark.svg" className="brand-logo" width="40" height="40" alt="" /><span className="brand-wordmark">Stane<span>Labs</span><span className="brand-period">.</span></span></a>;
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
    const body = `Nombre: ${values.get('name')}\nCorreo de contacto: ${values.get('email')}\nÁrea: ${topic}\n\n${values.get('message')}\n\nEnviado desde el sitio de StaneLabs.`;
    const url = `mailto:${config.contactEmail}?subject=${encodeURIComponent(`StaneLabs — ${topic}`)}&body=${encodeURIComponent(body)}`;
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
        <p className="form-note"><Icon name="lock" size={16} />{apiReady ? 'Tu consulta se enviará por correo a StaneLabs. No incluyas información sensible.' : 'Este formulario prepara un borrador en tu aplicación de correo. No guarda tus datos ni envía mensajes automáticamente.'}</p>
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
  const links = [['servicios', 'Especialidades'], ['enfoque', 'Nuestro enfoque'], ['contacto', 'Contacto']];
  return <header className={`site-header ${scrolled ? 'scrolled' : ''}`}><div className="header-inner"><Brand /><nav className="desktop-nav" aria-label="Navegación principal">{links.map(([id, label]) => <a key={id} href={`${home ? '' : '/'}#${id}`} className={`nav-link ${active === id ? 'active' : ''}`}>{label}</a>)}</nav><div className="header-end"><span className="locale" lang="es">ES</span><ContactDialog><Button size="sm" className="header-contact">Hablemos<Icon name="arrow-up-right" size={16} /></Button></ContactDialog><Button className="menu-button" size="icon" aria-expanded={menuOpen} aria-controls="mobile-menu" aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'} onClick={() => setMenuOpen(!menuOpen)}><Icon name={menuOpen ? 'x' : 'menu'} /></Button></div></div>{menuOpen && <nav id="mobile-menu" className="mobile-menu" aria-label="Navegación móvil">{links.map(([id, label]) => <a key={id} className="mobile-nav-link" href={`${home ? '' : '/'}#${id}`} onClick={() => setMenuOpen(false)}>{label}<Icon name="arrow-up-right" /></a>)}<a className="mobile-nav-link" href="/security" onClick={() => setMenuOpen(false)}>Seguridad<Icon name="arrow-up-right" /></a></nav>}</header>;
}

function Hero() {
  return <section className="hero-shell" aria-labelledby="hero-heading"><div className="container hero"><div className="hero-copy"><p className="eyebrow"><span className="eyebrow-dot" />INDEPENDENT SECURITY STUDIO</p><h1 id="hero-heading" className="hero-title">Tu información.<br />Tu identidad.<br /><span className="hero-title-accent">Tu control.</span></h1><p className="hero-description">Ciberseguridad, OPSEC y protección de datos sensibles. Una defensa consciente para lo que no puedes permitirte perder.</p><div className="hero-actions"><ContactDialog><Button>Hablemos de seguridad<Icon name="arrow-up-right" /></Button></ContactDialog><a className="text-link" href="#servicios">Explorar especialidades<Icon name="arrow-down-right" size={16} /></a></div></div><div className="hero-art" aria-hidden="true"><LiquidField /><div className="hero-art-note"><span>PROTECTION, BY DESIGN.</span><span>STANE / 001</span></div></div><div className="hero-bottom"><div className="hero-coordinates"><span>PRIVACIDAD COMO PRINCIPIO.</span><span>SEGURIDAD COMO PRÁCTICA.</span></div><a className="hero-scroll" href="#vision" aria-label="Descubrir nuestra visión"><span className="scroll-circle"><Icon name="arrow-down" size={20} /></span><span>Desliza para descubrir</span></a></div></div><div className="container hero-capabilities">{services.map(s => <a className="capability" href={`#${s.id}`} key={s.id}><span className="capability-number">{s.number} /</span><span>{s.title}</span><Icon name="arrow-up-right" size={16} /></a>)}</div></section>;
}

function Home() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const items = document.querySelectorAll('.reveal');
    document.documentElement.classList.add('has-motion');
    const observer = new IntersectionObserver(entries => { for (const entry of entries) if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); } }, { threshold: 0.08 });
    items.forEach(item => observer.observe(item));
    return () => { observer.disconnect(); document.documentElement.classList.remove('has-motion'); };
  }, []);
  return <><Hero />
    <section id="vision" className="section container"><div className="section-intro reveal"><p className="section-label">01 / NUESTRA VISIÓN</p><div><h2 className="editorial-heading">La mejor protección<br />empieza con <span>criterio.</span></h2><div className="section-copy"><p>No todo riesgo hace ruido. A veces es un acceso que nadie revisa, una identidad demasiado expuesta o un dato que circula más de lo necesario.</p><p>En StaneLabs conectamos seguridad técnica y operativa para ayudarte a decidir qué proteger, de quién y cómo. Menos complejidad. Más control.</p></div><p className="manifesto-line"><Icon name="minus" size={24} />Entender. Reducir. Proteger.</p></div></div></section>
    <section id="servicios" className="section container"><div className="services-header reveal"><div><p className="section-label">02 / ESPECIALIDADES</p><h2 className="editorial-heading">Tres perspectivas.<br />Una misma defensa.</h2></div><p className="section-copy">Sistemas, personas e información.<br />La seguridad funciona cuando los tres<br />se piensan juntos.</p></div>
      <Accordion type="single" collapsible className="service-list">{services.map(s => <AccordionItem id={s.id} key={s.id} value={s.id} className="service-item reveal"><div className="service-row"><span className="service-number">{s.number}</span><h3 className="service-title">{s.title}<span>{s.id === 'cyber' ? 'CYBERSECURITY' : s.id === 'opsec' ? 'OPSEC' : 'DATA PROTECTION'}</span></h3><p className="service-summary">{s.summary}</p><AccordionPrimitive.Header><AccordionPrimitive.Trigger asChild><Button size="icon" className="service-toggle" aria-label={`Ver detalles de ${s.title}`}><Icon name="plus" /></Button></AccordionPrimitive.Trigger></AccordionPrimitive.Header></div><AccordionContent className="service-detail"><div className="detail-columns">{s.details.map(([title, text]) => <div key={title}><h4 className="detail-heading">{title}</h4><p className="detail-copy">{text}</p></div>)}</div><ContactDialog service={s.title}><Button size="sm">Consultar sobre {s.title.toLowerCase()}<Icon name="arrow-up-right" size={16} /></Button></ContactDialog></AccordionContent></AccordionItem>)}</Accordion>
    </section>
    <section id="enfoque" className="section container"><div className="methodology-header reveal"><p className="section-label">03 / NUESTRO ENFOQUE</p><h2 className="editorial-heading">Primero entender.<br />Después actuar.</h2><p className="section-copy">Una metodología clara, sin atajos.<br />Cada decisión tiene un motivo.<br />Cada medida responde a tu contexto.</p></div><div className="process-grid">{workflowSteps.map(([title, text], i) => <div className="process-step reveal" key={title}><span className="process-number">0{i + 1}<Icon name={i === 3 ? 'check' : 'arrow-right'} size={20} /></span><h3 className="process-title">{title}</h3><p className="process-copy">{text}</p></div>)}</div></section>
    <section className="principles-band"><div className="container principles-layout"><div className="reveal"><p className="section-label">NUESTROS PRINCIPIOS</p><h2 className="editorial-heading">La confianza<br />también se diseña.</h2><p className="section-copy">La forma de trabajar importa tanto<br />como la solución.</p></div><Card className="principles-list reveal">{[['eye-off', 'Discreción por defecto', 'Compartir lo necesario. Limitar la exposición.'], ['sliders', 'Protección proporcionada', 'Decisiones ajustadas al riesgo y a tu realidad.'], ['file-text', 'Claridad en cada paso', 'Alcance definido y recomendaciones comprensibles.']].map(([icon, title, text]) => <div key={title} className="principle"><Icon name={icon as 'eye-off' | 'sliders' | 'file-text'} size={24} /><div><h3>{title}</h3><p>{text}</p></div></div>)}</Card></div></section>
    <section className="section container faq-layout"><div className="reveal"><p className="section-label">04 / CONVERSACIONES CLAVE</p><h2 className="editorial-heading">Antes de<br />dar el primer paso.</h2></div><Accordion type="single" collapsible className="faq-list reveal">{questions.map(([question, answer], i) => <AccordionItem value={`faq-${i}`} key={question} className="faq-item"><AccordionTrigger className="faq-question">{question}</AccordionTrigger><AccordionContent>{answer}{i === 3 && <p className="faq-policy-link"><a href="/security">Ver política de seguridad<Icon name="arrow-up-right" size={16} /></a></p>}</AccordionContent></AccordionItem>)}</Accordion></section>
    <section id="contacto" className="contact-section"><div className="container contact-layout reveal"><div><p className="section-label">05 / SIGUIENTE PASO</p><h2 className="contact-title">Lo importante<br />merece estar <span>protegido.</span></h2></div><div className="contact-copy"><p>Cuéntanos qué necesitas proteger.<br />Empecemos por una conversación.</p><div className="contact-actions"><ContactDialog><Button>Iniciar conversación<Icon name="arrow-up-right" /></Button></ContactDialog><a className="text-link" href={`mailto:${config.contactEmail}`}>{config.contactEmail}<Icon name="arrow-up-right" size={16} /></a></div><p className="contact-note"><Icon name="lock" size={16} />No compartas información sensible en el primer contacto.</p></div></div></section>
  </>;
}

const pageContent: Record<string, {label: string; title: string; lead: string; sections: {title: string; content: React.ReactNode}[]}> = {
  '/security': {label: 'SEGURIDAD / DIVULGACIÓN RESPONSABLE', title: 'La seguridad empieza con una conversación responsable.', lead: 'Si detectas una posible vulnerabilidad en este sitio, ayúdanos a comprenderla sin poner en riesgo a otras personas.', sections: [
    {title: 'Cómo comunicar un hallazgo', content: <><p>Escribe a <a href="mailto:security@stanelabs.com">security@stanelabs.com</a> con el asunto «Reporte de seguridad». Incluye la URL afectada, el comportamiento observado, el impacto potencial y los pasos mínimos para reproducirlo.</p><p>Evita enviar contraseñas, tokens, información personal de terceros o datos extraídos de sistemas. Si necesitas compartir material sensible, solicita primero un canal adecuado.</p></>},
    {title: 'Alcance y pautas', content: <><p>Esta página recoge el canal de comunicación para hallazgos relacionados con stanelabs.com. No concede autorización para realizar pruebas intrusivas ni para evaluar servicios de terceros.</p><p>No interrumpas el servicio, accedas a información ajena, modifiques datos ni utilices ingeniería social. Limita cualquier comprobación al mínimo necesario y detente si encuentras información sensible.</p></>},
    {title: 'Tratamiento del reporte', content: <p>Tu mensaje permite evaluar el hallazgo y coordinar los siguientes pasos. No se promete un plazo de respuesta, una recompensa ni participación en un programa de bug bounty. Cualquier divulgación pública debe coordinarse antes por este canal.</p>},
    {title: 'Archivo security.txt', content: <><p>El canal de seguridad también está disponible en formato legible por máquinas.</p><a className="text-link" href="/.well-known/security.txt">Consultar /.well-known/security.txt<Icon name="arrow-up-right" size={16} /></a></>},
  ]},
  '/privacy': {label: 'TRANSPARENCIA / PRIVACIDAD', title: 'Tu información, con límites claros.', lead: 'Esta nota explica el funcionamiento de este sitio y del primer contacto con StaneLabs.', sections: [
    {title: 'Navegación y almacenamiento', content: <p>El código de este sitio no incorpora herramientas de analítica, publicidad, cookies propias ni almacenamiento local para seguimiento. El proveedor de alojamiento puede tratar registros técnicos de las solicitudes, como la dirección IP, para servir y proteger el sitio. El acceso a una versión privada puede depender de la autenticación del proveedor.</p>},
    {title: 'Formulario de contacto', content: <><p>En esta versión de revisión, el formulario prepara un borrador en tu aplicación de correo. Si se conecta el backend y se configura el servicio de correo, el botón indica «Enviar consulta» y los datos se transmiten al servidor para remitir el mensaje al destinatario.</p><p>La aplicación no guarda los mensajes en una base de datos. Los proveedores de correo implicados y el destinatario gestionan el mensaje enviado. El backend utiliza la dirección IP para limitar solicitudes durante un breve período en memoria. Comparte únicamente los datos necesarios para iniciar la conversación.</p></>},
    {title: 'Recursos externos', content: <p>Las tipografías TikTok Sans y Geist se cargan desde Google Fonts. Esa carga genera solicitudes a Google que incluyen datos técnicos de conexión. Puedes consultar la <a href="https://developers.google.com/fonts/faq/privacy" target="_blank" rel="noopener noreferrer">información de privacidad de Google Fonts</a>.</p>},
    {title: 'Consultas sobre tus datos', content: <p>Para consultas relacionadas con información que hayas enviado, escribe a <a href="mailto:security@stanelabs.com">security@stanelabs.com</a>. Indica el contexto de tu solicitud sin adjuntar documentación personal innecesaria. Esta nota describe el sitio; el tratamiento aplicable a una colaboración se deberá acordar antes de empezar.</p>},
  ]},
  '/legal': {label: 'INFORMACIÓN / CONDICIONES DEL SITIO', title: 'Información clara. Alcance definido.', lead: 'Este sitio presenta el enfoque de StaneLabs en ciberseguridad, seguridad operativa y protección de datos.', sections: [
    {title: 'Información y contacto', content: <p>El dominio indicado para esta marca es <a href="https://stanelabs.com">stanelabs.com</a>. Puedes contactar a través de <a href="mailto:security@stanelabs.com">security@stanelabs.com</a>. La identificación fiscal, dirección y demás datos del titular deberán completarse antes del lanzamiento comercial público.{config.sitePrivate && ' Esta versión es una revisión privada.'}</p>},
    {title: 'Contenido y colaboración', content: <p>Los contenidos describen un enfoque general y no constituyen una evaluación de tu entorno. El alcance, los entregables y las condiciones de una posible colaboración deben definirse por escrito. No se garantiza la ausencia de riesgos ni la invulnerabilidad de un sistema.</p>},
    {title: 'Uso responsable', content: <p>Utiliza el sitio y el canal de contacto sin interferir en su disponibilidad ni enviar información a la que no tengas derecho de acceso. Cualquier hallazgo de seguridad puede comunicarse siguiendo las <a href="/security">pautas de divulgación responsable</a>.</p>},
    {title: 'Enlaces y recursos', content: <p>Los enlaces externos pueden dirigir a servicios con sus propias condiciones y políticas. Los recursos descargables de este sitio, incluidos el manifiesto y security.txt, describen esta versión y requieren mantenimiento cuando cambien los datos de contacto o el dominio.</p>},
  ]},
};
function LegalPage({ path }: {path: string}) {
  const data = pageContent[path];
  if (!data) return <div className="container legal-page"><h1>Página no encontrada.</h1><a href="/">Volver al inicio</a></div>;
  return <article className="container legal-page"><a className="back-link" href="/"><Icon name="arrow-left" size={16} />Volver a StaneLabs</a><div className="legal-header"><p className="section-label">{data.label}</p><h1>{data.title}</h1><p>{data.lead}</p><span className="legal-meta">Última actualización: 9 de octubre de 2026</span></div><div className="legal-content">{data.sections.map(section => <section className="legal-section" key={section.title}><h2>{section.title}</h2><div>{section.content}</div></section>)}</div></article>;
}
function Footer() {
  return <footer className="footer"><div className="container"><div className="footer-top"><Brand /><p>Menos exposición.<br />Más control.</p></div><div className="footer-grid"><div><p className="footer-label">ESPECIALIDADES</p><div className="footer-links"><a href="/#cyber">Ciberseguridad</a><a href="/#opsec">Seguridad operativa</a><a href="/#data">Protección de datos</a></div></div><div><p className="footer-label">STANELABS</p><div className="footer-links"><a href="/#enfoque">Nuestro enfoque</a><a href="/#contacto">Contacto</a><a href="mailto:security@stanelabs.com">security@stanelabs.com</a></div></div><div><p className="footer-label">TRANSPARENCIA</p><div className="footer-links"><a href="/security">Divulgación responsable</a><a href="/privacy">Privacidad</a><a href="/legal">Información legal</a><a href="/.well-known/security.txt">security.txt<Icon name="arrow-up-right" size={16} /></a></div></div></div><div className="footer-bottom"><span>© 2026 StaneLabs</span><span>SEGURIDAD CON CRITERIO.</span><a href="#top">Volver arriba<Icon name="arrow-up" size={16} /></a></div></div></footer>;
}
export default function App({ path = '/' }: { path?: string }) {
  const normalized = path.replace(/\/$/, '') || '/';
  return <><a href="#main" className="skip-link">Saltar al contenido</a><div id="top" /><Header home={normalized === '/'} /><main id="main">{normalized === '/' ? <Home /> : <LegalPage path={normalized} />}</main><Footer /></>;
}
