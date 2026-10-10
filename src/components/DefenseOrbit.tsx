import { Icon } from './Icon';

export default function DefenseOrbit() {
  return <div className="defense-diagram" aria-label="Defensa integrada de sistemas, personas e información">
    <div className="diagram-heading"><span>DEFENSA INTEGRADA</span><Icon name="crosshair" size={16} /></div>
    <div className="diagram-scene" aria-hidden="true">
      <svg viewBox="0 0 420 350" className="diagram-orbits"><ellipse cx="210" cy="175" rx="147" ry="112" /><ellipse cx="210" cy="175" rx="90" ry="67" /><path d="M210 63V110 M89 235L145 206 M331 235L275 206" /><g className="diagram-satellite"><ellipse cx="210" cy="175" rx="147" ry="112" /><circle cx="210" cy="63" r="4" /></g></svg>
      <div className="diagram-core"><img src="/brand/stane-mark.svg" alt="" width="52" height="52" /></div>
      <div className="diagram-node diagram-node-systems"><Icon name="server" size={20} /><span>Sistemas</span></div>
      <div className="diagram-node diagram-node-people"><Icon name="user" size={20} /><span>Personas</span></div>
      <div className="diagram-node diagram-node-data"><Icon name="lock" size={20} /><span>Datos</span></div>
      <span className="diagram-axis diagram-axis-one">01</span><span className="diagram-axis diagram-axis-two">02</span><span className="diagram-axis diagram-axis-three">03</span>
    </div>
    <p className="diagram-caption"><span className="eyebrow-dot" />Una perspectiva completa. Menos puntos ciegos.</p>
  </div>;
}
