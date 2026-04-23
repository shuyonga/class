var MAX_MODELS = 5;

function initConfigPage() {
    fetch('/api/get_config')
        .then(function(res) { return res.json(); })
        .then(function(cfg) {
            var models = cfg.models || [];
            // Ensure at least MAX_MODELS entries
            while (models.length < MAX_MODELS) {
                models.push({
                    display_name: '',
                    api_key: '',
                    base_url: '',
                    model_id: '',
                    enabled: false
                });
            }
            renderModelCards(models);
        })
        .catch(function(err) { console.error('Failed to load config:', err); });
}

function renderModelCards(models) {
    var container = document.getElementById('modelCards');
    container.innerHTML = '';
    models.forEach(function(m, i) {
        var card = document.createElement('div');
        card.className = 'model-card';
        card.innerHTML =
            '<h3>模型 ' + (i + 1) + '</h3>' +
            '<div class="field-group">' +
            '  <label>模型显示名称</label>' +
            '  <input type="text" id="mName' + i + '" value="' + escapeAttr(m.display_name || '') + '" placeholder="如：DeepSeek">' +
            '</div>' +
            '<div class="field-group">' +
            '  <label>API Key</label>' +
            '  <div class="api-key-row">' +
            '    <input type="password" id="mKey' + i + '" value="' + escapeAttr(m.api_key || '') + '" placeholder="sk-...">' +
            '    <button type="button" class="toggle-key-btn" id="mKeyToggle' + i + '" onclick="toggleApiKey(' + i + ')">显示</button>' +
            '  </div>' +
            '</div>' +
            '<div class="field-group">' +
            '  <label>Base URL</label>' +
            '  <input type="text" id="mUrl' + i + '" value="' + escapeAttr(m.base_url || '') + '" placeholder="https://api.deepseek.com">' +
            '</div>' +
            '<div class="field-group">' +
            '  <label>Model Identifier</label>' +
            '  <input type="text" id="mModel' + i + '" value="' + escapeAttr(m.model_id || '') + '" placeholder="deepseek-chat">' +
            '</div>' +
            '<div class="enable-row">' +
            '  <input type="checkbox" id="mEnabled' + i + '"' + (m.enabled ? ' checked' : '') + '>' +
            '  <label for="mEnabled' + i + '">启用此模型</label>' +
            '</div>';
        container.appendChild(card);
    });
}

function toggleApiKey(idx) {
    var input = document.getElementById('mKey' + idx);
    var btn = document.getElementById('mKeyToggle' + idx);
    if (!input || !btn) return;
    if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = '隐藏';
    } else {
        input.type = 'password';
        btn.textContent = '显示';
    }
}

function saveConfig() {
    var models = [];
    for (var i = 0; i < MAX_MODELS; i++) {
        var nameEl = document.getElementById('mName' + i);
        var keyEl = document.getElementById('mKey' + i);
        var urlEl = document.getElementById('mUrl' + i);
        var modelEl = document.getElementById('mModel' + i);
        var enabledEl = document.getElementById('mEnabled' + i);
        if (!nameEl) continue;
        models.push({
            display_name: nameEl.value.trim(),
            api_key: keyEl.value.trim(),
            base_url: urlEl.value.trim(),
            model_id: modelEl.value.trim(),
            enabled: enabledEl.checked
        });
    }

    // Also preserve secret_key by reading current config
    fetch('/api/get_config')
        .then(function(res) { return res.json(); })
        .then(function(oldCfg) {
            var payload = {
                models: models,
                secret_key: oldCfg.secret_key || ''
            };
            fetch('/api/save_config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
            .then(function(res) { return res.json(); })
            .then(function(data) {
                var msg = document.getElementById('configMsg');
                if (data.success) {
                    msg.textContent = '✅ 保存成功！';
                    msg.style.color = '#52c41a';
                } else {
                    msg.textContent = '❌ 保存失败';
                    msg.style.color = '#ff4d4f';
                }
                setTimeout(function() { msg.textContent = ''; }, 3000);
            })
            .catch(function(err) {
                var msg = document.getElementById('configMsg');
                msg.textContent = '❌ 保存出错：' + err;
                msg.style.color = '#ff4d4f';
            });
        })
        .catch(function(err) { console.error('Failed to read old config:', err); });
}

function escapeAttr(text) {
    return text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Init
initConfigPage();
