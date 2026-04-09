#!/usr/bin/env python3
"""
ToolVault PDF Encryption API
Run: python3 pdf_encrypt_server.py
Listens on port 5050
"""
import io
import pikepdf
from flask import Flask, request, send_file, jsonify

app = Flask(__name__)

# Manual CORS since flask-cors not available
@app.after_request
def add_cors(response):
    response.headers['Access-Control-Allow-Origin']  = '*'
    response.headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    return response

@app.route('/encrypt', methods=['OPTIONS'])
def encrypt_options():
    return '', 204

@app.route('/encrypt', methods=['POST'])
def encrypt_pdf():
    """Encrypt a PDF with AES-256 password protection."""
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400
    
    f        = request.files['file']
    password = request.form.get('password', '').strip()
    
    if not password:
        return jsonify({'error': 'Password is required'}), 400
    if len(password) < 4:
        return jsonify({'error': 'Password must be at least 4 characters'}), 400
    
    try:
        raw = f.read()
        
        # Try to open - handle already-encrypted PDFs
        try:
            pdf = pikepdf.open(io.BytesIO(raw))
        except pikepdf.PasswordError:
            return jsonify({'error': 'Input PDF is already password-protected. Remove protection first.'}), 400
        
        # Apply AES-256 encryption
        out_buf = io.BytesIO()
        pdf.save(
            out_buf,
            encryption=pikepdf.Encryption(
                owner=password + '_owner',  # owner pw (full access)
                user=password,              # user pw (open to view)
                aes=True,
                R=6,                        # PDF 2.0 AES-256
            )
        )
        out_buf.seek(0)
        
        fname = (f.filename or 'document').replace('.pdf','') + '_protected.pdf'
        return send_file(
            out_buf,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=fname,
        )
    
    except Exception as e:
        return jsonify({'error': f'Encryption failed: {str(e)}'}), 500


@app.route('/decrypt', methods=['OPTIONS'])
def decrypt_options():
    return '', 204

@app.route('/decrypt', methods=['POST'])
def decrypt_pdf():
    """Remove password protection from a PDF."""
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400
    
    f        = request.files['file']
    password = request.form.get('password', '').strip()
    
    try:
        raw = f.read()
        
        # Try with provided password, fallback to empty
        opened = False
        for pw in ([password] if password else []) + ['']:
            try:
                pdf = pikepdf.open(io.BytesIO(raw), password=pw)
                opened = True
                break
            except pikepdf.PasswordError:
                continue
        
        if not opened:
            return jsonify({'error': 'Incorrect password'}), 401
        
        # Save without encryption
        out_buf = io.BytesIO()
        pdf.save(out_buf)
        out_buf.seek(0)
        
        fname = (f.filename or 'document').replace('.pdf','') + '_unlocked.pdf'
        return send_file(
            out_buf,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=fname,
        )
    
    except pikepdf.PasswordError:
        return jsonify({'error': 'Incorrect password'}), 401
    except Exception as e:
        return jsonify({'error': f'Decryption failed: {str(e)}'}), 500


@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'engine': 'pikepdf AES-256'})


if __name__ == '__main__':
    print('ToolVault PDF Encryption API running on http://localhost:5050')
    app.run(host='0.0.0.0', port=5050, debug=False)