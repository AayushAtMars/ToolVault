"""
Vercel Serverless Function — PDF Encryption/Decryption
File: api/pdf.py

Vercel auto-deploys this as:
  POST https://yourapp.vercel.app/api/pdf?action=encrypt
  POST https://yourapp.vercel.app/api/pdf?action=decrypt
  GET  https://yourapp.vercel.app/api/pdf?action=health
"""
import io
import json
import cgi
from http.server import BaseHTTPRequestHandler

try:
    import pikepdf
    PIKEPDF_AVAILABLE = True
except ImportError:
    PIKEPDF_AVAILABLE = False


class handler(BaseHTTPRequestHandler):

    def _send(self, status, body, content_type='application/json'):
        self.send_response(status)
        self.send_header('Content-Type', content_type)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        if isinstance(body, (dict, list)):
            self.wfile.write(json.dumps(body).encode())
        else:
            self.wfile.write(body)

    def do_OPTIONS(self):
        self._send(204, b'')

    def do_GET(self):
        action = self._get_action()
        if action == 'health':
            self._send(200, {
                'status': 'ok',
                'engine': 'pikepdf' if PIKEPDF_AVAILABLE else 'unavailable',
                'version': pikepdf.__version__ if PIKEPDF_AVAILABLE else None,
            })
        else:
            self._send(400, {'error': 'Use POST with ?action=encrypt or ?action=decrypt'})

    def do_POST(self):
        if not PIKEPDF_AVAILABLE:
            self._send(500, {'error': 'pikepdf not available on this server'})
            return

        action = self._get_action()

        # Parse multipart form data
        content_type = self.headers.get('Content-Type', '')
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length)

        # Parse form fields
        environ = {
            'REQUEST_METHOD': 'POST',
            'CONTENT_TYPE': content_type,
            'CONTENT_LENGTH': str(content_length),
        }

        try:
            form = cgi.FieldStorage(
                fp=io.BytesIO(body),
                environ=environ,
                keep_blank_values=True,
            )
        except Exception as e:
            self._send(400, {'error': f'Failed to parse form: {str(e)}'})
            return

        if action == 'encrypt':
            self._handle_encrypt(form)
        elif action == 'decrypt':
            self._handle_decrypt(form)
        else:
            self._send(400, {'error': 'Invalid action. Use ?action=encrypt or ?action=decrypt'})

    def _get_action(self):
        from urllib.parse import urlparse, parse_qs
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)
        return params.get('action', [''])[0]

    def _handle_encrypt(self, form):
        # Get file
        if 'file' not in form:
            self._send(400, {'error': 'No file uploaded'}); return
        file_item = form['file']
        if not hasattr(file_item, 'file'):
            self._send(400, {'error': 'Invalid file field'}); return

        # Get password
        password = form.getvalue('password', '').strip()
        if not password:
            self._send(400, {'error': 'Password is required'}); return
        if len(password) < 4:
            self._send(400, {'error': 'Password must be at least 4 characters'}); return

        try:
            pdf_bytes = file_item.file.read()
            filename  = getattr(file_item, 'filename', 'document.pdf') or 'document.pdf'

            # Open PDF
            try:
                pdf = pikepdf.open(io.BytesIO(pdf_bytes))
            except pikepdf.PasswordError:
                self._send(400, {'error': 'Input PDF is already password-protected. Remove protection first.'}); return

            # Encrypt with AES-256
            out_buf = io.BytesIO()
            pdf.save(
                out_buf,
                encryption=pikepdf.Encryption(
                    owner=password + '_owner',
                    user=password,
                    aes=True,
                    R=6,  # AES-256 (PDF 2.0)
                )
            )
            out_buf.seek(0)
            out_bytes = out_buf.read()

            # Send encrypted PDF
            out_name = filename.replace('.pdf', '') + '_protected.pdf'
            self.send_response(200)
            self.send_header('Content-Type', 'application/pdf')
            self.send_header('Content-Disposition', f'attachment; filename="{out_name}"')
            self.send_header('Content-Length', str(len(out_bytes)))
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(out_bytes)

        except Exception as e:
            self._send(500, {'error': f'Encryption failed: {str(e)}'})

    def _handle_decrypt(self, form):
        if 'file' not in form:
            self._send(400, {'error': 'No file uploaded'}); return
        file_item = form['file']
        if not hasattr(file_item, 'file'):
            self._send(400, {'error': 'Invalid file field'}); return

        password = form.getvalue('password', '').strip()

        try:
            pdf_bytes = file_item.file.read()
            filename  = getattr(file_item, 'filename', 'document.pdf') or 'document.pdf'

            # Try to open with password
            opened = False
            for pw in ([password] if password else []) + ['']:
                try:
                    pdf = pikepdf.open(io.BytesIO(pdf_bytes), password=pw)
                    opened = True
                    break
                except pikepdf.PasswordError:
                    continue

            if not opened:
                self._send(401, {'error': 'Incorrect password'}); return

            # Save without encryption
            out_buf = io.BytesIO()
            pdf.save(out_buf)
            out_buf.seek(0)
            out_bytes = out_buf.read()

            out_name = filename.replace('.pdf', '') + '_unlocked.pdf'
            self.send_response(200)
            self.send_header('Content-Type', 'application/pdf')
            self.send_header('Content-Disposition', f'attachment; filename="{out_name}"')
            self.send_header('Content-Length', str(len(out_bytes)))
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(out_bytes)

        except pikepdf.PasswordError:
            self._send(401, {'error': 'Incorrect password'})
        except Exception as e:
            self._send(500, {'error': f'Decryption failed: {str(e)}'})