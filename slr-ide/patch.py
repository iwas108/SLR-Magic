import sys

with open('page_old.tsx', encoding='utf-8') as f:
    old_lines = f.readlines()

with open('src/app/page.tsx', encoding='utf-8') as f:
    new_lines = f.readlines()

# Extract pre-calibration from old_lines
old_precal_start = next(i for i, l in enumerate(old_lines) if ") : activeTab === 'pre-calibration' ? (" in l)
old_precal_end = next(i for i, l in enumerate(old_lines) if ") : activeTab !== 'database' && activeTab !== 'pre-calibration' ? (" in l)

old_precal_block = old_lines[old_precal_start:old_precal_end]

# Modify the Import Blinded (.slr) button inside old_precal_block
button_start = -1
for i, l in enumerate(old_precal_block):
    if 'Import Blinded (.slr)' in l:
        button_start = i
        break

# The label tag starts a few lines above and ends a few lines below.
label_start = -1
for i in range(button_start, -1, -1):
    if '<label' in old_precal_block[i]:
        label_start = i
        break

label_end = -1
for i in range(button_start, len(old_precal_block)):
    if '</label>' in old_precal_block[i]:
        label_end = i
        break

if label_start != -1 and label_end != -1:
    new_button = '''                      <button
                        onClick={() => setActiveTab('inter-rater')}
                        className="px-3 py-2 bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 uppercase tracking-wide text-[10px]"
                      >
                        <LayoutDashboard className="w-3.5 h-3.5" />
                        Inter-Rater Dashboard
                      </button>
'''
    old_precal_block[label_start:label_end+1] = [new_button]
else:
    print('Could not find Import Blinded label block')

# Now find where to replace in new_lines
new_precal_start = next(i for i, l in enumerate(new_lines) if ") : activeTab === 'pre-calibration' ? (" in l)
new_precal_end = next(i for i, l in enumerate(new_lines) if ") : activeTab !== 'database' && activeTab !== 'pre-calibration' ? (" in l)

# Also we need to add the activeTab === 'inter-rater' block
inter_rater_block = '''          ) : activeTab === 'inter-rater' ? (
            <div className="h-full flex flex-col overflow-hidden space-y-6 animate-in fade-in duration-200">
              <div className="flex-1 overflow-y-auto">
                <InterRaterDashboard
                  activeProjectId={activeProjectId}
                  activeProject={projects.find(p => p.id === activeProjectId)}
                  showToast={showToast}
                  loadCalPapers={loadCalPapers}
                  setCalActivePool={setCalActivePool}
                />
              </div>
            </div>
'''

final_lines = new_lines[:new_precal_start] + old_precal_block + [inter_rater_block] + new_lines[new_precal_end:]

# Update the activeTab !== condition
for i in range(len(final_lines)):
    if ") : activeTab !== 'database' && activeTab !== 'pre-calibration' ? (" in final_lines[i]:
        final_lines[i] = final_lines[i].replace(") : activeTab !== 'database' && activeTab !== 'pre-calibration' ? (", ") : activeTab !== 'database' && activeTab !== 'pre-calibration' && activeTab !== 'inter-rater' ? (")
        break

with open('src/app/page.tsx', 'w', encoding='utf-8') as f:
    f.writelines(final_lines)

print('Successfully patched src/app/page.tsx')
