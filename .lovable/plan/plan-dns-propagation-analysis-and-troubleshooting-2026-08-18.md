# Plan: DNS Propagation Analysis and Troubleshooting

The user is experiencing issues with DNS propagation for the domain `informacaohoje.com.br`. Analysis shows the domain is correctly registered at Registro.br, but DNS records (CNAME) are not yet resolving.

## Technical Details

- **Current Status**: The domain `www.informacaohoje.com.br` is registered in the database but marked as `pending`.
- **DNS Records**: `dig` results for `informacaohoje.com.br` and `www.informacaohoje.com.br` return `NXDOMAIN` (domain not found in DNS), indicating that either the nameservers are not set correctly at the registrar or the records haven't propagated yet.
- **Images Analysis**: The user provided screenshots from Registro.br showing CNAME and TXT records configured with Punycode (`xn--informacaohoje-8bb9c.com.br`). This is correct for domains with special characters (like "ç" or "ã"), though "informacaohoje" doesn't seem to have them, unless it was registered as "informaçãohoje".

## Actions

### 1. Verification of the registered domain name
Check if the user registered the domain with accents (e.g., `informaçãohoje.com.br`) which would explain the Punycode in the screenshots.

### 2. DNS Resolution Script
Create a small utility to check DNS more frequently without manual intervention, helping the user understand the propagation state.

### 3. DNS Instructions Update
Ensure the instructions in the UI match the Punycode version if the domain indeed contains special characters.

### 4. Database Sync
Update the `verification_status` if the records are found.

---

**Note for the user**: DNS propagation can take up to 72 hours. Since your domain is from `.com.br`, ensure that the DNS servers (NS) at Registro.br are pointing to a valid provider or that you are using "Modo Avançado" correctly. If you just changed the records, it might take a few hours to start appearing.