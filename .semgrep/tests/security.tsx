// SPDX-License-Identifier: MIT
// This file is test data for Semgrep, never application code.
import { exec, execFile, execSync } from 'node:child_process';
import * as childProcess from 'child_process';

declare const userInput: string;
declare const request: { body: string; query: string; params: string; headers: object };
declare const dto: object;
declare const exception: Error;
declare const element: HTMLElement;
declare const DOMPurify: { sanitize(value: string): string };
declare const feather: { icons: { shield: { toSvg(): string } } };

// ruleid: stanelabs.no-dynamic-code
eval(userInput);
// ruleid: stanelabs.no-dynamic-code
new Function(userInput);
// ruleid: stanelabs.no-dynamic-code
Function('return 1');
// ok: stanelabs.no-dynamic-code
JSON.parse(userInput);

// ruleid: stanelabs.nonconstant-shell-command
exec(userInput);
// ruleid: stanelabs.nonconstant-shell-command
execSync(`cat ${userInput}`);
// ruleid: stanelabs.nonconstant-shell-command
childProcess.exec(userInput);
// ruleid: stanelabs.nonconstant-shell-command
require('node:child_process').execSync(userInput);
// ok: stanelabs.nonconstant-shell-command
exec('node --version');
// ok: stanelabs.nonconstant-shell-command
execFile('node', ['--version']);
// ok: stanelabs.nonconstant-shell-command
childProcess.execSync('node --version');

// ruleid: stanelabs.no-tls-bypass
const insecureTls = { rejectUnauthorized: false };
// ruleid: stanelabs.no-tls-bypass
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
// ok: stanelabs.no-tls-bypass
const verifiedTls = { rejectUnauthorized: true };

// ruleid: stanelabs.no-sensitive-payload-logging
console.log(request.body);
// ruleid: stanelabs.no-sensitive-payload-logging
console.debug(request.headers);
// ruleid: stanelabs.no-sensitive-payload-logging
console.error(exception);
// ruleid: stanelabs.no-sensitive-payload-logging
console.info('contact', dto);
// ruleid: stanelabs.no-sensitive-payload-logging
console.warn(JSON.stringify(request.body));
// ok: stanelabs.no-sensitive-payload-logging
console.error('Mail delivery failed.');
// ok: stanelabs.no-sensitive-payload-logging
console.info({ event: 'contact-delivery', status: 'failed' });

// ruleid: stanelabs.untrusted-html
element.innerHTML = window.location.search;
// ruleid: stanelabs.untrusted-html
element.outerHTML = request.body;
const query = request.query;
// ruleid: stanelabs.untrusted-html
const unsafeMarkup = <div dangerouslySetInnerHTML={{ __html: query }} />;
// ok: stanelabs.untrusted-html
element.textContent = window.location.hash;
// ok: stanelabs.untrusted-html
element.innerHTML = DOMPurify.sanitize(window.location.search);
// ok: stanelabs.untrusted-html
const trustedIcon = <span dangerouslySetInnerHTML={{ __html: feather.icons.shield.toSvg() }} />;
// ok: stanelabs.untrusted-html
const structuredData = <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ name: 'StaneLabs' }).replace(/</g, '\\u003c') }} />;
