document.addEventListener('DOMContentLoaded', () => {
    const outputDiv = document.getElementById('output');
    const startButton = document.getElementById('startButton');
    const stopButton = document.getElementById('stopButton');
    const restartButton = document.getElementById('restartButton');
    const addRuleButton = document.getElementById('addRuleButton');
    const cancelEditButton = document.getElementById('cancelEditButton');
    const ruleFormTitle = document.getElementById('ruleFormTitle');
    const addBatchRulesButton = document.getElementById('addBatchRulesButton');
    const logoutButton = document.getElementById('logoutButton');
    const localPortInput = document.getElementById('localPort');
    const remoteIPInput = document.getElementById('remoteIP');
    const remotePortInput = document.getElementById('remotePort');
    const extraRemotesInput = document.getElementById('extraRemotes');
    const balanceStrategyInput = document.getElementById('balanceStrategy');
    const balanceWeightsInput = document.getElementById('balanceWeights');
    const rulesInput = document.getElementById('rulesInput');

    let allRules = [];
    let currentPage = 1;
    let pageSize = 10;
    let totalRules = 0;
    let editingListen = null;

    const pageSizeSelect = document.getElementById('pageSizeSelect');

    async function updateServiceStatus() {
        try {
            const response = await fetch(`/check_status?_=${Date.now()}`);
            if (!response.ok) {
                throw new Error('检查状态失败：' + response.statusText);
            }
            const data = await response.json();
            const statusElement = document.getElementById('serviceStatus');
            
            if (data.status === "启用") {
                statusElement.textContent = "运行中";
                statusElement.className = 'status-tag running';
            } else {
                statusElement.textContent = "已停止";
                statusElement.className = 'status-tag stopped';
            }
        } catch (error) {
            console.error('状态检查失败:', error);
            const statusElement = document.getElementById('serviceStatus');
            statusElement.textContent = "未知";
            statusElement.className = 'status-tag stopped';
        }
    }

    async function fetchForwardingRules(targetPage = currentPage) {
        try {
            const response = await fetch(`/get_rules?page=${targetPage}&size=${pageSize}&_=${Date.now()}`, {
                method: 'GET',
                headers: {
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                },
            });

            if (!response.ok) {
                throw new Error('获取规则失败：' + response.statusText);
            }

            const data = await response.json();
            if (!Array.isArray(data.rules)) {
                data.rules = [];
            }

            totalRules = data.total;
            const totalPages = Math.max(1, Math.ceil(totalRules / pageSize));
            currentPage = Math.min(Math.max(1, targetPage), totalPages);

            allRules = data.rules.map(rule => {
                const listen = rule.Listen || rule.listen;
                const remote = rule.Remote || rule.remote;
                const extraRemotes = rule.ExtraRemotes || rule.extra_remotes || [];
                const balance = rule.Balance || rule.balance || '';
                return { listen, remote, extraRemotes, balance };
            });

            renderForwardingRules();

            return allRules;
        } catch (error) {
            console.error('获取规则失败:', error);
            outputDiv.textContent = `获取转发规则失败: ${error.message}`;
            return [];
        }
    }

    async function refreshRulesAfterChange() {
        const totalPagesAfterChange = Math.max(1, Math.ceil(totalRules / pageSize));
        await fetchForwardingRules(totalPagesAfterChange);
    }

    function splitHostPort(value) {
        if (!value) {
            return null;
        }

        if (value.startsWith('[')) {
            const closingBracketIndex = value.indexOf(']');
            if (closingBracketIndex === -1 || value[closingBracketIndex + 1] !== ':') {
                return null;
            }

            const host = value.slice(1, closingBracketIndex);
            const port = value.slice(closingBracketIndex + 2);
            if (!host || !port) {
                return null;
            }

            return { host, port };
        }

        const colonIndex = value.lastIndexOf(':');
        if (colonIndex <= 0 || colonIndex === value.length - 1) {
            return null;
        }

        if (value.includes(':', colonIndex + 1) || value.includes(':') && value.indexOf(':') !== colonIndex) {
            return null;
        }

        return {
            host: value.slice(0, colonIndex),
            port: value.slice(colonIndex + 1)
        };
    }

    function renderForwardingRules() {
        const tbody = document.querySelector('#forwardingTable tbody');
        tbody.innerHTML = '';

        allRules.forEach((rule, index) => {
            const listen = rule.listen || '';
            const remote = rule.remote || '';
            const extraRemotes = Array.isArray(rule.extraRemotes) ? rule.extraRemotes : [];
            const balance = rule.balance || '';

            if (!listen || !remote) return;

            const listenParts = splitHostPort(listen);
            const localPort = listenParts?.port || listen;

            const row = document.createElement('tr');
            const values = [
                (currentPage - 1) * pageSize + index + 1,
                localPort,
                [remote, ...extraRemotes].join('\n'),
                formatBalance(balance, extraRemotes.length + 1)
            ];
            values.forEach((value, cellIndex) => {
                const cell = document.createElement('td');
                cell.textContent = value;
                if (cellIndex === 2) {
                    cell.className = 'remote-list';
                }
                row.appendChild(cell);
            });

            const actionCell = document.createElement('td');
            const editButton = document.createElement('button');
            editButton.className = 'edit-btn';
            editButton.textContent = '编辑';
            editButton.addEventListener('click', () => beginEdit(rule));
            actionCell.appendChild(editButton);

            const deleteButton = document.createElement('button');
            deleteButton.className = 'delete-btn';
            deleteButton.dataset.listen = listen;
            deleteButton.textContent = '删除';
            actionCell.appendChild(deleteButton);
            row.appendChild(actionCell);
            tbody.appendChild(row);
        });

        document.querySelectorAll('.delete-btn').forEach(button => {
            button.addEventListener('click', function() {
                deleteRule(this.getAttribute('data-listen'));
            });
        });

        updatePaginationInfo();
    }

    function formatBalance(balance, backendCount) {
        if (!balance) {
            return backendCount > 1 ? '未设置' : '单节点';
        }

        const colonIndex = balance.indexOf(':');
        const strategy = colonIndex === -1 ? balance : balance.slice(0, colonIndex).trim();
        const weights = colonIndex === -1 ? '' : balance.slice(colonIndex + 1).trim();
        const strategyLabel = strategy === 'roundrobin' ? '轮询' : strategy === 'iphash' ? '来源 IP 固定' : strategy;
        return weights ? `${strategyLabel}\n权重 ${weights}` : strategyLabel;
    }

    function formatHostPort(host, port) {
        const trimmedHost = host.trim();
        if (trimmedHost.startsWith('[') && trimmedHost.endsWith(']')) {
            return `${trimmedHost}:${port}`;
        }
        if (trimmedHost.includes(':')) {
            return `[${trimmedHost}]:${port}`;
        }
        return `${trimmedHost}:${port}`;
    }

    function formatListenAddress(port) {
        if (editingListen) {
            const originalListen = splitHostPort(editingListen);
            if (originalListen) {
                return formatHostPort(originalListen.host, port);
            }
        }
        return `[::]:${port}`;
    }

    function updateBalanceFields() {
        const hasExtraRemotes = extraRemotesInput.value.trim().length > 0;
        balanceStrategyInput.disabled = !hasExtraRemotes;
        balanceWeightsInput.disabled = !hasExtraRemotes;
    }

    function beginEdit(rule) {
        const listenParts = splitHostPort(rule.listen);
        const remoteParts = splitHostPort(rule.remote);
        if (!listenParts || !remoteParts) {
            outputDiv.textContent = '该规则地址格式无法在表单中编辑';
            return;
        }

        editingListen = rule.listen;
        localPortInput.value = listenParts.port;
        remoteIPInput.value = remoteParts.host;
        remotePortInput.value = remoteParts.port;
        extraRemotesInput.value = (rule.extraRemotes || []).join('\n');

        const balance = rule.balance || '';
        const colonIndex = balance.indexOf(':');
        if (colonIndex !== -1) {
            const strategy = balance.slice(0, colonIndex).trim();
            if (strategy === 'roundrobin' || strategy === 'iphash') {
                balanceStrategyInput.value = strategy;
            }
            balanceWeightsInput.value = balance.slice(colonIndex + 1).trim();
        } else {
            balanceStrategyInput.value = 'roundrobin';
            balanceWeightsInput.value = '';
        }

        updateBalanceFields();
        ruleFormTitle.textContent = '编辑转发规则';
        addRuleButton.textContent = '保存修改';
        cancelEditButton.hidden = false;
        ruleFormTitle.scrollIntoView({ behavior: 'smooth', block: 'start' });
        localPortInput.focus({ preventScroll: true });
    }

    function resetRuleForm() {
        editingListen = null;
        localPortInput.value = '';
        remoteIPInput.value = '';
        remotePortInput.value = '';
        extraRemotesInput.value = '';
        balanceWeightsInput.value = '';
        balanceStrategyInput.value = 'roundrobin';
        ruleFormTitle.textContent = '添加转发规则';
        addRuleButton.textContent = '添加规则';
        cancelEditButton.hidden = true;
        updateBalanceFields();
    }

    function updatePaginationInfo() {
        const pageInfo = document.getElementById('pageInfo');
        const totalPages = Math.ceil(totalRules / pageSize);
        pageInfo.textContent = `第 ${currentPage} / ${totalPages === 0 ? 1 : totalPages} 页`;

        document.getElementById('prevPage').disabled = (currentPage <= 1);
        document.getElementById('nextPage').disabled = (currentPage >= totalPages || totalPages === 0);
    }

    function goToPrevPage() {
        if (currentPage > 1) {
            currentPage--;
            fetchForwardingRules();
        }
    }

    function goToNextPage() {
        const totalPages = Math.ceil(totalRules / pageSize);
        if (currentPage < totalPages) {
            currentPage++;
            fetchForwardingRules();
        }
    }

    async function deleteRule(listenAddress) {
        try {
            const response = await fetch(`/delete_rule?listen=${encodeURIComponent(listenAddress)}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error('删除规则失败：' + response.statusText);
            }

            const restartResponse = await fetch('/restart_service', {
                method: 'POST'
            });
            if (!restartResponse.ok) {
                throw new Error('重启服务失败：' + restartResponse.statusText);
            }

            outputDiv.textContent = '规则已删除，服务已重启';
            if (editingListen === listenAddress) {
                resetRuleForm();
            }
            await refreshRulesAfterChange();
            await updateServiceStatus();
        } catch (error) {
            console.error('删除失败:', error);
            outputDiv.textContent = error.message;
        }
    }

    async function addRule() {
        const localPort = localPortInput.value.trim();
        const remoteIP = remoteIPInput.value.trim();
        const remotePort = remotePortInput.value.trim();
        const extraRemotes = extraRemotesInput.value
            .split('\n')
            .map(value => value.trim())
            .filter(Boolean);

        if (!localPort || !remoteIP || !remotePort) {
            outputDiv.textContent = '请填写所有字段';
            return;
        }

        try {
            const portIsUsed = allRules.some(rule => {
                const rulePort = splitHostPort(rule.listen)?.port;
                return rule.listen !== editingListen && rulePort === localPort;
            });
            if (portIsUsed) {
                outputDiv.textContent = `端口 ${localPort} 已被占用`;
                return;
            }

            const backendCount = 1 + extraRemotes.length;
            let balance = '';
            if (extraRemotes.length > 0) {
                let weights;
                if (balanceWeightsInput.value.trim()) {
                    weights = balanceWeightsInput.value.split(',').map(value => value.trim());
                    if (weights.length !== backendCount || weights.some(value => !/^\d+$/.test(value) || Number(value) < 1)) {
                        outputDiv.textContent = `权重必须填写 ${backendCount} 个大于 0 的整数`;
                        return;
                    }
                } else {
                    weights = Array(backendCount).fill('1');
                }
                balance = `${balanceStrategyInput.value}: ${weights.join(', ')}`;
            }

            const isEditing = editingListen !== null;
            const requestURL = isEditing
                ? `/update_rule?listen=${encodeURIComponent(editingListen)}`
                : '/add_rule';
            const response = await fetch(requestURL, {
                method: isEditing ? 'PUT' : 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    listen: formatListenAddress(localPort),
                    remote: formatHostPort(remoteIP, remotePort),
                    extra_remotes: extraRemotes,
                    balance
                })
            });

            if (!response.ok) {
                let detail = response.statusText;
                try {
                    const errorData = await response.json();
                    detail = errorData.error || detail;
                } catch (_) {
                    // 保留 HTTP 状态文本。
                }
                throw new Error(`${isEditing ? '修改' : '添加'}规则失败：${detail}`);
            }

            const restartResponse = await fetch('/restart_service', {
                method: 'POST'
            });
            if (!restartResponse.ok) {
                throw new Error('重启服务失败：' + restartResponse.statusText);
            }

            outputDiv.textContent = `规则${isEditing ? '修改' : '添加'}成功，服务已重启`;
            resetRuleForm();
            if (isEditing) {
                await fetchForwardingRules(currentPage);
            } else {
                totalRules += 1;
                await refreshRulesAfterChange();
            }
            await updateServiceStatus();
        } catch (error) {
            console.error('添加失败:', error);
            outputDiv.textContent = error.message;
        }
    }

    async function addBatchRules() {
        const rules = rulesInput.value.trim().split('\n').filter(Boolean);
        if (rules.length === 0) {
            outputDiv.textContent = '请输入要添加的规则';
            return;
        }

        const usedPorts = new Set(allRules.map(r => r.listen.substring(r.listen.lastIndexOf(':') + 1)));
        const failedRules = [];
        let hasSuccess = false;

        for (const rule of rules) {
            const match = rule.match(/^(\d+):(\[.*?\]:\d+|\S+)$/);
            if (!match) {
                failedRules.push(`格式错误: ${rule}`);
                continue;
            }

            const localPort = match[1];
            const remoteAddress = match[2];

            if (usedPorts.has(localPort)) {
                failedRules.push(`端口 ${localPort} 已被占用`);
                continue;
            }

            try {
                const response = await fetch('/add_rule', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        listen: `[::]:${localPort}`,
                        remote: remoteAddress
                    })
                });

                if (!response.ok) {
                    failedRules.push(`添加失败: ${rule}`);
                    continue;
                }

                usedPorts.add(localPort);
                hasSuccess = true;
            } catch (error) {
                failedRules.push(`添加失败: ${rule} - ${error.message}`);
            }
        }

        if (hasSuccess) {
            try {
                const restartResponse = await fetch('/restart_service', {
                    method: 'POST'
                });
                if (!restartResponse.ok) {
                    throw new Error('重启服务失败');
                }
            } catch (error) {
                failedRules.push('服务重启失败');
            }
        }

        rulesInput.value = '';
        if (hasSuccess) {
            totalRules += rules.length - failedRules.length;
        }
        await refreshRulesAfterChange();
        await updateServiceStatus();

        if (failedRules.length > 0) {
            outputDiv.textContent = `添加完成。\n失败的规则：\n${failedRules.join('\n')}`;
        } else {
            outputDiv.textContent = '所有规则添加成功，服务已重启';
        }
    }

    startButton.addEventListener('click', async () => {
        try {
            const response = await fetch('/start_service', {
                method: 'POST'
            });
            if (!response.ok) {
                throw new Error('启动服务失败：' + response.statusText);
            }
            outputDiv.textContent = '服务启动成功';
            await updateServiceStatus();
        } catch (error) {
            console.error('启动失败:', error);
            outputDiv.textContent = error.message;
        }
    });

    stopButton.addEventListener('click', async () => {
        try {
            const response = await fetch('/stop_service', {
                method: 'POST'
            });
            if (!response.ok) {
                throw new Error('停止服务失败：' + response.statusText);
            }
            outputDiv.textContent = '服务停止成功';
            await updateServiceStatus();
        } catch (error) {
            console.error('停止失败:', error);
            outputDiv.textContent = error.message;
        }
    });

    restartButton.addEventListener('click', async () => {
        try {
            const response = await fetch('/restart_service', {
                method: 'POST'
            });
            if (!response.ok) {
                throw new Error('重启服务失败：' + response.statusText);
            }
            outputDiv.textContent = '服务重启成功';
            await updateServiceStatus();
        } catch (error) {
            console.error('重启失败:', error);
            outputDiv.textContent = error.message;
        }
    });

    logoutButton.addEventListener('click', async () => {
        try {
            const response = await fetch('/logout', {
                method: 'POST'
            });
            if (response.ok) {
                window.location.href = '/login';
            } else {
                throw new Error('登出失败：' + response.statusText);
            }
        } catch (error) {
            console.error('登出失败:', error);
            outputDiv.textContent = error.message;
        }
    });

    addRuleButton.addEventListener('click', addRule);
    cancelEditButton.addEventListener('click', () => {
        resetRuleForm();
        outputDiv.textContent = '已取消编辑';
    });
    addBatchRulesButton.addEventListener('click', addBatchRules);
    extraRemotesInput.addEventListener('input', updateBalanceFields);

    document.getElementById('prevPage').addEventListener('click', goToPrevPage);
    document.getElementById('nextPage').addEventListener('click', goToNextPage);

    pageSizeSelect.addEventListener('change', () => {
        pageSize = parseInt(pageSizeSelect.value, 10);
        currentPage = 1;
        fetchForwardingRules();
    });

    updateBalanceFields();
    fetchForwardingRules();
    updateServiceStatus();
    
    setInterval(updateServiceStatus, 15000);
});
