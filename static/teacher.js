// === State ===
var prepQuestions = [];
var teachQuestions = [];
var currentPackageName = '';

// === Tab Switching ===
function switchTab(tab) {
    var tabPrep = document.getElementById('tabPrep');
    var tabTeach = document.getElementById('tabTeach');
    var panelPrep = document.getElementById('panelPrep');
    var panelTeach = document.getElementById('panelTeach');

    if (tab === 'prep') {
        tabPrep.classList.add('active');
        tabTeach.classList.remove('active');
        panelPrep.classList.add('active');
        panelTeach.classList.remove('active');
        refreshPackageList('loadPackageSelect');
    } else {
        tabTeach.classList.add('active');
        tabPrep.classList.remove('active');
        panelTeach.classList.add('active');
        panelPrep.classList.remove('active');
        refreshPackageList('teachPackageSelect');
        loadModels();
    }
}

// === Package List Refresh ===
function refreshPackageList(selectId) {
    var sel = document.getElementById(selectId);
    fetch('/api/list_question_packages')
        .then(function(res) { return res.json(); })
        .then(function(data) {
            sel.innerHTML = '<option value="">-- 请选择 --</option>';
            var pkgs = data.packages || [];
            pkgs.forEach(function(f) {
                var opt = document.createElement('option');
                opt.value = f;
                opt.textContent = f.replace(/\.json$/, '');
                sel.appendChild(opt);
            });
        })
        .catch(function(err) { console.error('Failed to list packages:', err); });
}

// === Prep Mode Functions ===
function createPackage() {
    var name = document.getElementById('packageNameInput').value.trim();
    if (!name) {
        alert('请输入题目包名称');
        return;
    }
    currentPackageName = name;
    prepQuestions = [];
    document.getElementById('prepEditSection').style.display = 'block';
    document.getElementById('prepPreviewSection').style.display = 'block';
    renderPrepList();
}

function addQuestion() {
    var type = document.getElementById('questionTypeSelect').value;
    var content = document.getElementById('questionContentInput').value.trim();
    if (!content) {
        alert('请输入题目内容');
        return;
    }
    prepQuestions.push({ content: content, type: type });
    document.getElementById('questionContentInput').value = '';
    renderPrepList();
}

function removePrepQuestion(idx) {
    prepQuestions.splice(idx, 1);
    renderPrepList();
}

function renderPrepList() {
    var list = document.getElementById('prepQuestionList');
    list.innerHTML = '';
    prepQuestions.forEach(function(q, i) {
        var li = document.createElement('li');
        li.innerHTML = '<span><span class="q-idx">#' + (i + 1) + '</span><span class="q-type-badge">' + q.type + '</span>' + escapeHtml(q.content) + '</span>' +
            '<button class="q-del-btn" onclick="removePrepQuestion(' + i + ')">✕</button>';
        list.appendChild(li);
    });
}

function savePackage() {
    var name = document.getElementById('packageNameInput').value.trim();
    if (!name) {
        alert('请输入题目包名称');
        return;
    }
    if (prepQuestions.length === 0) {
        alert('请至少添加一道题目');
        return;
    }
    var pkg = {
        title: name,
        questions: prepQuestions
    };
    fetch('/api/save_question_package', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pkg)
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
        if (data.success) {
            alert('保存成功！');
            refreshPackageList('loadPackageSelect');
        } else {
            alert('保存失败');
        }
    })
    .catch(function(err) { alert('保存出错：' + err); });
}

function loadPackage() {
    var sel = document.getElementById('loadPackageSelect');
    var filename = sel.value;
    if (!filename) {
        alert('请先选择一个题目包');
        return;
    }
    fetch('/api/load_question_package', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: filename })
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
        if (data.success) {
            var pkg = data.package;
            currentPackageName = pkg.title || filename.replace(/\.json$/, '');
            prepQuestions = pkg.questions || [];
            document.getElementById('packageNameInput').value = currentPackageName;
            document.getElementById('prepEditSection').style.display = 'block';
            document.getElementById('prepPreviewSection').style.display = 'block';
            renderPrepList();
        } else {
            alert('加载失败');
        }
    })
    .catch(function(err) { alert('加载出错：' + err); });
}

// === Teach Mode Functions ===
function loadTeachPackage() {
    var sel = document.getElementById('teachPackageSelect');
    var filename = sel.value;
    if (!filename) {
        alert('请先选择一个题目包');
        return;
    }
    fetch('/api/load_question_package', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: filename })
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
        if (data.success) {
            var pkg = data.package;
            teachQuestions = pkg.questions || [];
            document.getElementById('teachQuestionSection').style.display = 'block';
            renderTeachList();
        } else {
            alert('加载失败');
        }
    })
    .catch(function(err) { alert('加载出错：' + err); });
}

function onTeachPackageChange() {
    // Do nothing special; user needs to click "加载"
}

function renderTeachList() {
    var list = document.getElementById('teachQuestionList');
    list.innerHTML = '';
    teachQuestions.forEach(function(q, i) {
        var li = document.createElement('li');
        li.id = 'teachQ' + i;
        li.innerHTML = '<span><span class="q-type-badge">' + q.type + '</span>' + escapeHtml(q.content) + '</span>' +
            '<button class="pub-btn" onclick="publishQuestion(' + i + ')">发布</button>';
        list.appendChild(li);
    });
}

function publishQuestion(idx) {
    var q = teachQuestions[idx];
    if (!q) return;
    fetch('/api/publish_question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: q.content, type: q.type })
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
        if (data.success) {
            // Highlight current question
            var items = document.querySelectorAll('#teachQuestionList li');
            items.forEach(function(li) { li.classList.remove('active-q'); });
            var activeLi = document.getElementById('teachQ' + idx);
            if (activeLi) activeLi.classList.add('active-q');
            refreshDisplay();
        }
    })
    .catch(function(err) { console.error('Publish failed:', err); });
}

// === Clear Round ===
function clearRound() {
    if (!confirm('确定清空本轮数据吗？当前答案将被存档。')) return;
    fetch('/api/clear_round', { method: 'POST' })
        .then(function(res) { return res.json(); })
        .then(function(data) {
            if (data.success) {
                refreshDisplay();
            }
        })
        .catch(function(err) { console.error('Clear failed:', err); });
}

// === Model Selection ===
function loadModels() {
    var sel = document.getElementById('modelSelect');
    fetch('/api/get_models')
        .then(function(res) { return res.json(); })
        .then(function(data) {
            sel.innerHTML = '<option value="">-- 请选择模型 --</option>';
            var models = data.models || [];
            models.forEach(function(m) {
                var opt = document.createElement('option');
                opt.value = m.display_name;
                opt.textContent = m.display_name;
                sel.appendChild(opt);
            });
        })
        .catch(function(err) { console.error('Failed to load models:', err); });
}

function onModelChange() {
    var sel = document.getElementById('modelSelect');
    var name = sel.value;
    if (!name) return;
    fetch('/api/set_model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model_display_name: name })
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
        if (data.success) {
            console.log('Model set to:', name);
        }
    })
    .catch(function(err) { console.error('Set model failed:', err); });
}

// === AI Analyze ===
function aiAnalyze() {
    var resultDiv = document.getElementById('aiResult');
    resultDiv.style.display = 'block';
    resultDiv.textContent = '正在分析中，请稍候...';

    fetch('/api/ai_analyze', { method: 'POST' })
        .then(function(res) { return res.json(); })
        .then(function(data) {
            if (data.success) {
                resultDiv.textContent = data.analysis;
            } else {
                resultDiv.textContent = '分析失败：' + (data.message || '未知错误');
            }
        })
        .catch(function(err) {
            resultDiv.textContent = '请求出错：' + err;
        });
}

// === Display Data Refresh ===
function refreshDisplay() {
    fetch('/api/get_display_data')
        .then(function(res) { return res.json(); })
        .then(function(data) {
            // Question display
            if (data.content && data.content.trim()) {
                document.getElementById('displayNoQuestion').style.display = 'none';
                document.getElementById('displayQuestionContent').style.display = 'block';
                document.getElementById('displayQType').textContent = data.type;
                document.getElementById('displayQContent').textContent = data.content;
            } else {
                document.getElementById('displayNoQuestion').style.display = 'block';
                document.getElementById('displayQuestionContent').style.display = 'none';
            }

            // Understanding stats
            document.getElementById('statUnderstood').textContent = data.understood;
            document.getElementById('statPartial').textContent = data.partial;
            document.getElementById('statConfused').textContent = data.confused;

            // Submit count
            document.getElementById('submitCount').textContent = data.total;

            // Answers list
            var answersList = document.getElementById('answersList');
            answersList.innerHTML = '';
            var answers = data.answers || [];
            answers.forEach(function(a) {
                var div = document.createElement('div');
                div.className = 'answer-item ai-' + a.understanding;
                div.textContent = a.answer + ' (' + a.understanding_cn + ')';
                answersList.appendChild(div);
            });
        })
        .catch(function(err) { console.error('Refresh display failed:', err); });
}

// === Utility ===
function escapeHtml(text) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(text));
    return div.innerHTML;
}

// === Init ===
refreshPackageList('teachPackageSelect');
loadModels();
refreshDisplay();

// Auto-refresh every 2 seconds
setInterval(refreshDisplay, 2000);
