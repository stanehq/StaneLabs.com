import App from '../../src/App';
import { pageMetadata } from '../../src/lib/metadata';
export const metadata = pageMetadata('/purchase');
export default function Page() { return <App path="/purchase" />; }
