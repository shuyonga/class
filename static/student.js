(function() {
    var answerInput = document.getElementById('answerInput');
    var submitBtn = document.getElementById('submitBtn');
    var submittedMsg = document.getElementById('submittedMsg');
    var waitingMsg = document.getElementById('waitingMsg');
    var questionDisplay = document.getElementById('questionDisplay');
    var qType = document.getElementById('qType');
    var qContent = document.getElementById('qContent');
    var answerArea = document.getElementById('answerArea');
    var understandingGroup = document.getElementById('understandingGroup');

    var labels = {
        understood: document.getElementById('labelUnderstood'),
        partial: document.getElementById('labelPartial'),
        confused: document.getElementById('labelConfused')
    };

    var selectedUnderstanding = '';

    // Radio button visual feedback
    var radios = understandingGroup.querySelectorAll('input[type="radio"]');
    radios.forEach(function(radio) {
        radio.addEventListener('change', function() {
            selectedUnderstanding = this.value;
            // Reset all labels
            labels.understood.className = 'u-understood';
            labels.partial.className = 'u-partial';
            labels.confused.className = 'u-confused';
            // Activate selected
            if (this.value === 'understood') {
                labels.understood.classList.add('active-understood');
            } else if (this.value === 'partial') {
                labels.partial.classList.add('active-partial');
            } else if (this.value === 'confused') {
                labels.confused.classList.add('active-confused');
            }
            validateForm();
        });
    });

    function validateForm() {
        var answerVal = answerInput.value.trim();
        if (answerVal.length > 0 && selectedUnderstanding) {
            submitBtn.disabled = false;
        } else {
            submitBtn.disabled = true;
        }
    }

    answerInput.addEventListener('input', validateForm);

    // Poll for current question
    function fetchQuestion() {
        fetch('/api/get_current_question')
            .then(function(res) { return res.json(); })
            .then(function(data) {
                if (data.content && data.content.trim() !== '') {
                    waitingMsg.style.display = 'none';
                    questionDisplay.style.display = 'block';
                    answerArea.style.display = 'block';
                    qType.textContent = data.type;
                    qContent.textContent = data.content;
                } else {
                    waitingMsg.style.display = 'block';
                    questionDisplay.style.display = 'none';
                    answerArea.style.display = 'none';
                    submittedMsg.style.display = 'none';
                }
            })
            .catch(function(err) {
                console.error('Failed to fetch question:', err);
            });
    }

    // Initial fetch and polling
    fetchQuestion();
    setInterval(fetchQuestion, 2000);

    // Submit answer
    submitBtn.addEventListener('click', function() {
        var answer = answerInput.value.trim();
        if (!answer || !selectedUnderstanding) return;

        submitBtn.disabled = true;
        submitBtn.textContent = '提交中...';

        fetch('/api/submit_answer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                answer: answer,
                understanding: selectedUnderstanding
            })
        })
        .then(function(res) { return res.json(); })
        .then(function(data) {
            if (data.success) {
                submittedMsg.style.display = 'block';
                submitBtn.textContent = '重新提交';
                submitBtn.disabled = false;
            } else {
                alert('提交失败，请重试');
                submitBtn.textContent = '提交';
                submitBtn.disabled = false;
            }
        })
        .catch(function(err) {
            alert('网络错误，请重试');
            submitBtn.textContent = '提交';
            submitBtn.disabled = false;
        });
    });
})();
