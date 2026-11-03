'use strict';
const DEFAULT_LOGO='logo.png';
        const categories = {
            '收入': [
                '社區據點 / 長照課程鐘點',
                '運動中心課程 / 專案指導',
                '私人運動訓練指導 (1對1/小團班)',
                '健康促進講座 / 企業工作坊',
                '醫療診所 / 協會專案合作',
                '師資培訓 / 研習課程收入',
                '運動器材 / 商品銷售',
                '其他營業收入'
            ],
            '支出': [
                '交通與差旅費 (高鐵/油資/船機票/住宿)',
                '運動中心 / 場地租借費',
                '外聘講師 / 助教鐘點費',
                '教具與體適能器材採購',
                '行銷廣告與社群經營費 (IG/FB/剪輯)',
                '文具印刷與講義教材費',
                '餐飲與客戶交際費',
                '稅務 / 保險 / 行政規費',
                '其他營業支出'
            ]
        };

        const defaultTemplates = [];


function escapeHTML(value) {return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

function getTodayStr() {
            const now = new Date();
            const yyyy = now.getFullYear();
            const mm = String(now.getMonth() + 1).padStart(2, '0');
            const dd = String(now.getDate()).padStart(2, '0');
            return `${yyyy}-${mm}-${dd}`;
        }


function showToast(msg) {
            const toast = document.getElementById('toast');
            toast.textContent = msg;
            toast.classList.remove('opacity-0');
            setTimeout(() => toast.classList.add('opacity-0'), 2500);
        }

        // --- 快速月份導航按鈕邏輯 ---

function setMonthCurrent() {
            document.getElementById('filter-month').value = getTodayStr().slice(0, 7);
            renderRecords();
            showToast('📅 已切換至「本月」帳務');
        }

function shiftMonth(offset) {
            const monthInput = document.getElementById('filter-month');
            let val = monthInput.value;
            let year, month;
            if (!val) {
                const now = new Date();
                year = now.getFullYear();
                month = now.getMonth() + 1;
            } else {
                const parts = val.split('-');
                year = parseInt(parts[0], 10);
                month = parseInt(parts[1], 10);
            }
            month += offset;
            if (month > 12) { month = 1; year++; }
            else if (month < 1) { month = 12; year--; }
            
            monthInput.value = `${year}-${String(month).padStart(2, '0')}`;
            renderRecords();
            showToast(`📅 已切換至 ${monthInput.value} 帳務`);
        }

function quickSetDate(offsetDays) {
            const dateInput = document.getElementById('date');
            let baseDate = new Date();
            if (Math.abs(offsetDays) === 7 && dateInput.value) {
                const [y, m, d] = dateInput.value.split('-').map(Number);
                baseDate = new Date(y, m - 1, d);
            }
            baseDate.setDate(baseDate.getDate() + offsetDays);
            const yyyy = baseDate.getFullYear();
            const mm = String(baseDate.getMonth() + 1).padStart(2, '0');
            const dd = String(baseDate.getDate()).padStart(2, '0');
            dateInput.value = `${yyyy}-${mm}-${dd}`;
            showToast(`📅 已將日期設定為 ${dateInput.value}`);
        }

function editRecord(id) {
            const r = records.find(item => item.id === id);
            if (!r) return;

            document.getElementById('editing-id').value = r.id;
            document.getElementById('date').value = r.date;
            setType(r.type);
            ensureCategory(r.category);
            document.getElementById('amount').value = r.amount;
            document.getElementById('note').value = r.note;

            document.getElementById('is-recurring').checked = false;
            document.getElementById('recurring-box').classList.add('hidden');
            document.getElementById('form-title').innerHTML = '✏️ 修改帳務紀錄 <span class="text-xs font-normal text-amber-600">(編輯模式)</span>';
            document.getElementById('submit-btn').textContent = '💾 儲存修改內容';
            document.getElementById('submit-btn').className = 'flex-1 bg-brand-brown hover:bg-brand-brownDark text-white font-bold py-3 px-4 rounded-xl shadow transition text-base';
            document.getElementById('cancel-edit-btn').classList.remove('hidden');
            document.getElementById('form-card').classList.add('ring-4', 'ring-brand-yellow');

            renderRecords();
            window.scrollTo({ top: 0, behavior: 'smooth' });
            showToast(`✏️ 正在修改「${r.note}」，調整後請按儲存修改！`);
        }

function cancelEdit() {
            document.getElementById('editing-id').value = '';
            document.getElementById('amount').value = '';
            document.getElementById('note').value = '';
            document.getElementById('recurring-box').classList.remove('hidden');
            document.getElementById('form-title').textContent = '➕ 新增帳務紀錄';
            document.getElementById('submit-btn').textContent = '確認儲存紀錄';
            document.getElementById('submit-btn').className = 'flex-1 bg-brand-yellow hover:bg-brand-yellowDark text-brand-brown font-bold py-3 px-4 rounded-xl shadow transition text-base';
            document.getElementById('cancel-edit-btn').classList.add('hidden');
            document.getElementById('form-card').classList.remove('ring-4', 'ring-brand-yellow');
            renderRecords();
        }

function renderTemplates() {
            const container = document.getElementById('templates-container');
            container.innerHTML = '';
            if (templates.length === 0) {
                container.innerHTML = '<span class="text-xs text-brand-brown/50">尚無常用範本，填寫下方表單後點右上角「⭐ 存為常用範本」即可新增！</span>';
                return;
            }
            templates.forEach(t => {
                const isIncome = t.type === '收入';
                const chip = document.createElement('div');
                chip.className = `inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition border ${
                    isIncome ? 'bg-brand-greenLight text-brand-brown border-brand-green/40 hover:bg-brand-green/20' : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                }`;
                chip.innerHTML = `
                    <span onclick="applyTemplate(${t.id})">${isIncome ? '💰' : '💸'} ${escapeHTML(t.note)} ($${t.amount})</span>
                    <button type="button" onclick="deleteTemplate(event, ${t.id})" class="ml-1 text-brand-brown/40 hover:text-rose-600 font-bold" title="刪除此快捷鍵">×</button>
                `;
                container.appendChild(chip);
            });
        }

function applyTemplate(id) {
            const t = templates.find(item => item.id === id);
            if (!t) return;
            setType(t.type);
            ensureCategory(t.category);
            document.getElementById('amount').value = t.amount;
            document.getElementById('note').value = t.note;
            showToast(`⚡ 已帶入「${t.note}」，確認上方日期後即可儲存！`);
        }

function updateRecentNotesDatalist() {
            const datalist = document.getElementById('recent-notes');
            const uniqueNotes = [...new Set(records.map(r => r.note.replace(/\s*\(\d+\/\d+\)$/, '')).filter(n => n && n !== '-'))];
            datalist.innerHTML = uniqueNotes.map(n => `<option value="${escapeHTML(n)}">`).join('');
        }

function toggleRecurring() {
            const checked = document.getElementById('is-recurring').checked;
            const optionsDiv = document.getElementById('recurring-options');
            const submitBtn = document.getElementById('submit-btn');
            if (checked) {
                optionsDiv.classList.remove('hidden');
                submitBtn.textContent = '📅 批次產生多筆紀錄';
            } else {
                optionsDiv.classList.add('hidden');
                submitBtn.textContent = '確認儲存紀錄';
            }
        }

function applyCustomLogo(dataUrl) {
            const img = document.getElementById('custom-logo-img');
            const svg = document.getElementById('default-logo-svg');
            img.src = dataUrl;
            img.classList.remove('hidden');
            svg.classList.add('hidden');
        }

function setType(type) {
            document.getElementById('type').value = type;
            const btnIncome = document.getElementById('btn-income');
            const btnExpense = document.getElementById('btn-expense');
            if (type === '收入') {
                btnIncome.className = 'py-2.5 px-4 rounded-xl font-bold border text-center transition bg-brand-green text-white border-brand-green shadow-sm';
                btnExpense.className = 'py-2.5 px-4 rounded-xl font-bold border text-center transition bg-brand-yellowLight text-brand-brown/70 border-brand-brown/15 hover:bg-brand-yellow/30';
            } else {
                btnExpense.className = 'py-2.5 px-4 rounded-xl font-bold border text-center transition bg-rose-500 text-white border-rose-500 shadow-sm';
                btnIncome.className = 'py-2.5 px-4 rounded-xl font-bold border text-center transition bg-brand-yellowLight text-brand-brown/70 border-brand-brown/15 hover:bg-brand-yellow/30';
            }
            updateCategoryOptions(type);
        }

function ensureCategory(value){const el=document.getElementById('category');if(!Array.from(el.options).some(o=>o.value===value))el.add(new Option(value,value));el.value=value;}

function updateCategoryOptions(type) {
            const select = document.getElementById('category');
            if (!select) return;
            select.innerHTML = '';
            const list = categories[type] || [];
            list.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat;
                option.textContent = cat;
                select.appendChild(option);
            });
        }

function resetFilters() {
            document.getElementById('filter-month').value = '';
            document.getElementById('filter-type').value = 'all';
            document.getElementById('filter-keyword').value = '';
            renderRecords();
        }

function renderRecords() {
            const tbody = document.getElementById('records-tbody');
            const emptyState = document.getElementById('empty-state');
            const keyword = document.getElementById('filter-keyword').value.trim().toLowerCase();
            const filterMonth = document.getElementById('filter-month').value;
            const filterType = document.getElementById('filter-type').value;
            const currentEditId = document.getElementById('editing-id').value;
            tbody.innerHTML = '';
            
            let filteredIncome = 0;
            let filteredExpense = 0;

            const filtered = records.filter(r => {
                const matchMonth = filterMonth ? r.date.startsWith(filterMonth) : true;
                const matchType = filterType !== 'all' ? r.type === filterType : true;
                const matchKeyword = keyword ? (r.note.toLowerCase().includes(keyword) || r.category.toLowerCase().includes(keyword)) : true;
                return matchMonth && matchType && matchKeyword;
            });

            // 計算目前篩選結果的總收入與總支出
            records.forEach(r => {
                const matchMonth = filterMonth ? r.date.startsWith(filterMonth) : true;
                const matchType = filterType !== 'all' ? r.type === filterType : true;
                const matchKeyword = keyword ? (r.note.toLowerCase().includes(keyword) || r.category.toLowerCase().includes(keyword)) : true;
                if (matchMonth && matchType && matchKeyword) {
                    if (r.type === '收入') filteredIncome += r.amount;
                    if (r.type === '支出') filteredExpense += r.amount;
                }
            });

            if (filtered.length === 0) {
                emptyState.classList.remove('hidden');
            } else {
                emptyState.classList.add('hidden');
                filtered.forEach(r => {
                    const tr = document.createElement('tr');
                    const isEditingThis = (currentEditId && Number(currentEditId) === r.id);
                    tr.className = isEditingThis ? 'editing-highlight transition' : 'hover:bg-brand-yellowLight/50 transition';
                    
                    const badgeClass = r.type === '收入' ? 'bg-brand-greenLight text-brand-green border border-brand-green/30' : 'bg-rose-50 text-rose-600 border border-rose-200';
                    const amountClass = r.type === '收入' ? 'text-brand-green font-bold' : 'text-rose-500 font-bold';
                    const sign = r.type === '收入' ? '+' : '-';

                    tr.innerHTML = `
                        <td data-label="日期" class="py-3 px-3 whitespace-nowrap align-middle">
                            <input type="date" value="${r.date}" onchange="updateRecordDateInline(${r.id}, this.value)" title="點擊可直接修改日期" class="border border-brand-brown/20 hover:border-brand-yellow focus:border-brand-brown rounded-lg px-2 py-1 text-xs font-mono text-brand-brown bg-brand-bg/60 cursor-pointer transition">
                        </td>
                        <td data-label="類型" class="py-3 px-2 whitespace-nowrap align-middle"><span class="px-2 py-0.5 rounded-full text-xs font-semibold ${badgeClass}">${r.type}</span></td>
                        <td data-label="項目" class="py-3 px-4 align-middle">
                            <div class="font-bold text-brand-brown text-sm leading-snug">${escapeHTML(r.note)}</div>
                            <div class="text-xs text-brand-brown/60 mt-0.5">${escapeHTML(r.category)}</div>
                        </td>
                        <td data-label="金額" class="py-3 px-3 text-right whitespace-nowrap align-middle ${amountClass}">${sign} NT$ ${r.amount.toLocaleString()}</td>
                        <td data-label="操作" class="py-3 px-3 text-center whitespace-nowrap align-middle">
                            <div class="inline-flex items-center gap-1">
                                <button onclick="editRecord(${r.id})" class="px-2 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-brand-brown text-xs font-semibold border border-amber-300 transition" title="編輯">✏️</button>
                                <button onclick="duplicateRecordToForm(${r.id}, false)" class="px-2 py-1 rounded-lg bg-brand-yellowLight hover:bg-brand-yellow/60 text-brand-brown text-xs font-medium border border-brand-brown/15 transition" title="複製">📋</button>
                                <button onclick="duplicateRecordToForm(${r.id}, true)" class="px-2 py-1 rounded-lg bg-brand-greenLight hover:bg-brand-green/30 text-brand-brown text-xs font-medium border border-brand-green/30 transition" title="今日+1">➕</button>
                                <button onclick="deleteRecord(${r.id})" class="p-1 text-brand-brown/30 hover:text-rose-500 transition ml-0.5" title="刪除">✖</button>
                            </div>
                        </td>
                    `;
                    tbody.appendChild(tr);
                });
            }

            // 更新上方總覽卡片文字與數值
            const titleSuffix = filterMonth ? ` (${filterMonth})` : ' (全部)';
            document.getElementById('income-card-title').textContent = `當前篩選 - 總收入${titleSuffix}`;
            document.getElementById('expense-card-title').textContent = `當前篩選 - 總支出${titleSuffix}`;
            document.getElementById('balance-card-title').textContent = `當前篩選 - 淨利結餘${titleSuffix}`;

            const netBalance = filteredIncome - filteredExpense;
            document.getElementById('total-income').textContent = `NT$ ${filteredIncome.toLocaleString()}`;
            document.getElementById('total-expense').textContent = `NT$ ${filteredExpense.toLocaleString()}`;
            const netEl = document.getElementById('net-balance');
            netEl.textContent = `NT$ ${netBalance.toLocaleString()}`;
            netEl.className = `text-2xl font-bold mt-1 ${netBalance >= 0 ? 'text-brand-brown' : 'text-rose-600'}`;
        }

function saveFile(filename, content) {
            const blob = new Blob([content], {type: filename.endsWith('.json') ? 'application/json;charset=utf-8' : 'text/csv;charset=utf-8'});
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a'); link.href = url; link.download = filename;
            document.body.appendChild(link); link.click(); link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 60000);
        }

function exportCSV() {
            const cell = value => { let str=String(value); if (/^[=+@\-\t\r]/.test(str)) str="'"+str; return '"'+str.replace(/"/g,'""')+'"'; };
            const rows = records.map(r => [r.date,r.type,r.category,r.amount,r.note].map(cell).join(','));
            saveFile(`樂頤生收支報表_${getTodayStr()}.csv`, '\uFEFF日期,收支類型,項目分類,金額,專案或備註\r\n'+rows.join('\r\n'));
        }
