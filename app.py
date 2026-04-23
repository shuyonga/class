import os
import sys
import json
import time
import uuid
import re
import socket
import webbrowser
import requests
from urllib.parse import urlparse
from datetime import datetime

from flask import Flask, render_template, request, jsonify, session, send_from_directory

# === Path Utilities ===
def get_path(relative_path):
    """Get path for read-only resource files (templates, static)."""
    base_path = getattr(sys, '_MEIPASS', os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base_path, relative_path)

def get_data_path(relative_path=""):
    """Get path for writable data files (config, data, questions)."""
    if getattr(sys, 'frozen', False):
        base_path = os.path.dirname(sys.executable)
    else:
        base_path = os.getcwd()
    if relative_path:
        return os.path.join(base_path, relative_path)
    return base_path

# === App Initialization ===
app = Flask(
    __name__,
    template_folder=get_path('templates'),
    static_folder=get_path('static')
)

# === Directory Auto-Creation ===
data_dir = get_data_path('data')
questions_dir = get_data_path('questions')
os.makedirs(data_dir, exist_ok=True)
os.makedirs(questions_dir, exist_ok=True)

# === Config Loading ===
config_path = get_data_path('config.json')

def load_config():
    if os.path.exists(config_path):
        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            return {}
    return {}

def save_config(cfg):
    with open(config_path, 'w', encoding='utf-8') as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)

config = load_config()

# === Secret Key ===
if 'secret_key' in config:
    app.secret_key = config['secret_key']
else:
    sk = os.urandom(24).hex()
    app.secret_key = sk
    config['secret_key'] = sk
    save_config(config)
    print("[WARNING] secret_key not found in config.json, generated and saved a new one.")

# === Initialize models in config if missing ===
if 'models' not in config:
    config['models'] = []
    save_config(config)

# === Global In-Memory Data ===
current_question = None
current_answers = []
current_model = ""
current_package_name = ""

# === Helper: Sanitize Filename ===
def sanitize_filename(name):
    return re.sub(r'[\\/:*?"<>|]', '_', name)

# === Helper: Get Local IP ===
def get_local_ip():
    preferred_prefixes = ('192.168.', '10.')
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(2)
        s.connect(('8.8.8.8', 80))
        local_ip = s.getsockname()[0]
        s.close()
        if local_ip.startswith(preferred_prefixes) or local_ip.startswith('172.'):
            parts = local_ip.split('.')
            if local_ip.startswith('172.') and len(parts) == 4:
                second = int(parts[1])
                if 16 <= second <= 31:
                    return local_ip
            else:
                return local_ip
    except Exception:
        pass
    # Fallback: enumerate interfaces
    try:
        hostname = socket.gethostname()
        addrs = socket.getaddrinfo(hostname, None, socket.AF_INET)
        for addr in addrs:
            ip = addr[4][0]
            if ip.startswith(preferred_prefixes):
                return ip
            if ip.startswith('172.'):
                parts = ip.split('.')
                if len(parts) == 4 and 16 <= int(parts[1]) <= 31:
                    return ip
    except Exception:
        pass
    return None

# === Helper: Generate QR Code ===
def generate_qrcode(url, save_path):
    try:
        import qrcode
        img = qrcode.make(url)
        img.save(save_path)
        return True
    except Exception as e:
        print(f"[WARNING] Failed to generate QR code: {e}")
        return False

# === Helper: Normalize Base URL ===
def normalize_base_url(base_url):
    """Strip trailing slash, keep only scheme+netloc, then append /v1/chat/completions."""
    base_url = base_url.strip().rstrip('/')
    parsed = urlparse(base_url)
    scheme = parsed.scheme
    netloc = parsed.netloc
    if not scheme or not netloc:
        return base_url.rstrip('/') + '/v1/chat/completions'
    return f"{scheme}://{netloc}/v1/chat/completions"

# === Routes: Pages ===
@app.route('/')
def index():
    return redirect_to_teacher()

def redirect_to_teacher():
    from flask import redirect
    return redirect('/teacher')

@app.route('/student')
def student_page():
    return render_template('student.html')

@app.route('/teacher')
def teacher_page():
    return render_template('teacher.html')

@app.route('/config')
def config_page():
    return render_template('config.html')

# === Routes: API ===
@app.route('/api/get_current_question', methods=['GET'])
def api_get_current_question():
    if current_question is None:
        return jsonify({"content": "", "type": ""})
    return jsonify({"content": current_question["content"], "type": current_question["type"]})

@app.route('/api/submit_answer', methods=['POST'])
def api_submit_answer():
    global current_answers
    data = request.get_json()
    if not data:
        return jsonify({"success": False, "message": "No data received"}), 400

    # Ensure anonymous_id exists in session
    if 'anonymous_id' not in session:
        session['anonymous_id'] = uuid.uuid4().hex[:8]

    answer = data.get('answer', '').strip()
    understanding = data.get('understanding', '')
    ts = time.time()

    # Find existing answer by anonymous_id and update, or append
    found = False
    for i, a in enumerate(current_answers):
        if a['anonymous_id'] == session['anonymous_id']:
            current_answers[i] = {
                "anonymous_id": session['anonymous_id'],
                "answer": answer,
                "understanding": understanding,
                "timestamp": ts
            }
            found = True
            break
    if not found:
        current_answers.append({
            "anonymous_id": session['anonymous_id'],
            "answer": answer,
            "understanding": understanding,
            "timestamp": ts
        })

    return jsonify({"success": True, "message": "Answer submitted successfully"})

@app.route('/api/get_display_data', methods=['GET'])
def api_get_display_data():
    q_content = ""
    q_type = ""
    if current_question:
        q_content = current_question["content"]
        q_type = current_question["type"]

    understood = sum(1 for a in current_answers if a['understanding'] == 'understood')
    partial = sum(1 for a in current_answers if a['understanding'] == 'partial')
    confused = sum(1 for a in current_answers if a['understanding'] == 'confused')

    understanding_map = {
        'understood': '懂了',
        'partial': '有点懂',
        'confused': '没懂'
    }

    answers_display = []
    for a in current_answers:
        understanding_cn = understanding_map.get(a['understanding'], a['understanding'])
        answers_display.append({
            "answer": a['answer'],
            "understanding": a['understanding'],
            "understanding_cn": understanding_cn
        })

    return jsonify({
        "content": q_content,
        "type": q_type,
        "understood": understood,
        "partial": partial,
        "confused": confused,
        "total": len(current_answers),
        "answers": answers_display
    })

@app.route('/api/publish_question', methods=['POST'])
def api_publish_question():
    global current_question
    data = request.get_json()
    if not data:
        return jsonify({"success": False, "message": "No data received"}), 400
    current_question = {
        "content": data.get('content', ''),
        "type": data.get('type', '')
    }
    return jsonify({"success": True})

@app.route('/api/clear_round', methods=['POST'])
def api_clear_round():
    global current_answers, current_question
    # Archive current answers
    if current_answers:
        pkg_name = current_package_name if current_package_name else "unknown"
        q_idx = "0"
        if current_question:
            pass
        ts_str = str(int(time.time()))
        safe_pkg = sanitize_filename(pkg_name)
        archive_name = f"{safe_pkg}_{q_idx}_{ts_str}.json"
        archive_path = os.path.join(data_dir, archive_name)
        archive_data = {
            "question": current_question,
            "answers": current_answers
        }
        try:
            with open(archive_path, 'w', encoding='utf-8') as f:
                json.dump(archive_data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"[ERROR] Failed to archive data: {e}")

    current_answers = []
    current_question = None
    return jsonify({"success": True})

@app.route('/api/list_question_packages', methods=['GET'])
def api_list_question_packages():
    files = []
    if os.path.exists(questions_dir):
        for f in os.listdir(questions_dir):
            if f.endswith('.json'):
                files.append(f)
    return jsonify({"packages": files})

@app.route('/api/save_question_package', methods=['POST'])
def api_save_question_package():
    data = request.get_json()
    if not data:
        return jsonify({"success": False, "message": "No data received"}), 400
    title = data.get('title', 'untitled')
    safe_title = sanitize_filename(title)
    filepath = os.path.join(questions_dir, f"{safe_title}.json")
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    return jsonify({"success": True, "filename": f"{safe_title}.json"})

@app.route('/api/load_question_package', methods=['POST'])
def api_load_question_package():
    global current_package_name
    data = request.get_json()
    if not data:
        return jsonify({"success": False, "message": "No data received"}), 400
    filename = data.get('filename', '')
    filepath = os.path.join(questions_dir, filename)
    if not os.path.exists(filepath):
        return jsonify({"success": False, "message": "File not found"}), 404
    with open(filepath, 'r', encoding='utf-8') as f:
        pkg = json.load(f)
    # Track the package name for archiving
    current_package_name = pkg.get('title', filename.replace('.json', ''))
    return jsonify({"success": True, "package": pkg})

@app.route('/api/get_config', methods=['GET'])
def api_get_config():
    cfg = load_config()
    return jsonify(cfg)

@app.route('/api/save_config', methods=['POST'])
def api_save_config():
    data = request.get_json()
    if not data:
        return jsonify({"success": False, "message": "No data received"}), 400
    # Preserve secret_key
    old_cfg = load_config()
    if 'secret_key' not in data and 'secret_key' in old_cfg:
        data['secret_key'] = old_cfg['secret_key']
    save_config(data)
    return jsonify({"success": True})

@app.route('/api/set_model', methods=['POST'])
def api_set_model():
    global current_model
    data = request.get_json()
    if not data:
        return jsonify({"success": False, "message": "No data received"}), 400
    current_model = data.get('model_display_name', '')
    return jsonify({"success": True})

@app.route('/api/get_models', methods=['GET'])
def api_get_models():
    cfg = load_config()
    models = cfg.get('models', [])
    enabled = [m for m in models if m.get('enabled', False)]
    return jsonify({"models": enabled})

@app.route('/api/ai_analyze', methods=['POST'])
def api_ai_analyze():
    global current_model
    cfg = load_config()
    models = cfg.get('models', [])

    # Find the current model config
    model_cfg = None
    for m in models:
        if m.get('display_name', '') == current_model:
            model_cfg = m
            break

    if not model_cfg:
        return jsonify({"success": False, "message": "No valid model selected or configured"}), 400

    api_key = model_cfg.get('api_key', '')
    base_url = model_cfg.get('base_url', '')
    model_identifier = model_cfg.get('model_id', '')

    if not api_key or not base_url or not model_identifier:
        return jsonify({"success": False, "message": "Model configuration incomplete"}), 400

    # Build prompt based on question type
    if not current_question:
        return jsonify({"success": False, "message": "No question published yet"}), 400

    q_content = current_question['content']
    q_type = current_question['type']
    answer_list = [a['answer'] for a in current_answers]
    answers_text = '\n'.join(answer_list) if answer_list else '（暂无学生提交答案）'

    closed_types = ['选择题', '判断题', '填空题', '口算题', '口算']
    open_types = ['笔算题', '应用题', '笔算']

    if q_type in closed_types:
        prompt = (
            f"你是一位小学数学助教。现在有一道{q_type}题：\"{q_content}\"。"
            f"学生匿名提交的答案如下（一行一个）：\n{answers_text}\n"
            f"请按以下格式回复：\n"
            f"1. 正确答案是：XX\n"
            f"2. 全班正确率：XX%\n"
            f"3. 最常见错误：XX\n"
            f"4. 可能原因：XX\n"
            f"请务必使用简体中文回复，不要使用英文或其他语言。"
        )
    elif q_type in open_types:
        prompt = (
            f"你是一位小学数学助教。现在有一道{q_type}题：\"{q_content}\"。"
            f"学生匿名提交的最终答案如下（一行一个）：\n{answers_text}\n"
            f"请按以下格式回复：\n"
            f"1. 正确答案是：XX\n"
            f"2. 全班正确率：XX%\n"
            f"请务必使用简体中文回复，不要使用英文或其他语言。"
        )
    else:
        # Default to closed type format
        prompt = (
            f"你是一位小学数学助教。现在有一道{q_type}题：\"{q_content}\"。"
            f"学生匿名提交的答案如下（一行一个）：\n{answers_text}\n"
            f"请按以下格式回复：\n"
            f"1. 正确答案是：XX\n"
            f"2. 全班正确率：XX%\n"
            f"3. 最常见错误：XX\n"
            f"4. 可能原因：XX\n"
            f"请务必使用简体中文回复，不要使用英文或其他语言。"
        )

    # Call AI API
    full_url = normalize_base_url(base_url)
    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json'
    }
    payload = {
        'model': model_identifier,
        'messages': [{'role': 'user', 'content': prompt}],
        'temperature': 0.1
    }

    try:
        resp = requests.post(full_url, headers=headers, json=payload, timeout=60)
        resp.raise_for_status()
        result = resp.json()
        analysis = result['choices'][0]['message']['content']

        # Clean AI response: remove <think...</thinkblock> blocks
        analysis = re.sub(r'<think\b[^>]*>.*?</think\s*>', '', analysis, flags=re.DOTALL)
        analysis = re.sub(r'</?think>', '', analysis)
        analysis = analysis.strip()

        return jsonify({"success": True, "analysis": analysis})
    except requests.exceptions.Timeout:
        return jsonify({"success": False, "message": "AI request timed out, please try again"}), 504
    except requests.exceptions.RequestException as e:
        return jsonify({"success": False, "message": f"AI request failed: {str(e)}"}), 500
    except (KeyError, IndexError, json.JSONDecodeError) as e:
        return jsonify({"success": False, "message": f"AI response parsing failed: {str(e)}"}), 500

@app.route('/qrcode.png')
def qrcode_img():
    qr_path = get_data_path('qrcode.png')
    directory = os.path.dirname(qr_path)
    filename = os.path.basename(qr_path)
    return send_from_directory(directory, filename)

# === Main Entry ===
if __name__ == '__main__':
    # Get local IP
    local_ip = get_local_ip()
    if local_ip is None:
        local_ip = '127.0.0.1'
        print("\033[91m[WARNING] Failed to detect LAN IP, falling back to 127.0.0.1. Students on other devices may not be able to connect.\033[0m")

    # Try ports
    preferred_port = 5050
    actual_port = None
    for port in range(preferred_port, preferred_port + 5):
        try:
            test_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            test_sock.settimeout(1)
            test_sock.bind(('0.0.0.0', port))
            test_sock.close()
            actual_port = port
            break
        except OSError:
            continue

    if actual_port is None:
        print("\033[91m[ERROR] Ports 5050-5054 are all occupied. Please release a port and try again.\033[0m")
        input("Press Enter to exit...")
        sys.exit(1)

    # Generate QR code
    student_url = f"http://{local_ip}:{actual_port}/student"
    qr_save_path = get_data_path('qrcode.png')
    if generate_qrcode(student_url, qr_save_path):
        print(f"[INFO] QR code saved to: {qr_save_path}")
    else:
        print("[WARNING] QR code generation failed, students can still access via URL.")

    # Print startup info
    print("=" * 50)
    print("  Math King Glory - Real-time Feedback System")
    print("=" * 50)
    print(f"  Teacher Page: http://{local_ip}:{actual_port}/teacher")
    print(f"  Student Page: http://{local_ip}:{actual_port}/student")
    print(f"  Config Page:  http://{local_ip}:{actual_port}/config")
    print(f"  QR Code:      {qr_save_path}")
    print("=" * 50)

    # Auto-open browser
    teacher_url = f"http://{local_ip}:{actual_port}/teacher"
    webbrowser.open(teacher_url)

    # Run Flask
    app.run(host='0.0.0.0', port=actual_port, debug=False)
