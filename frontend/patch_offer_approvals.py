import sys

file_path = "d:\\Downloads\\Phygitron360\\frontend\\src\\pages\\source\\OfferApprovals.jsx"

try:
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    import re
    # We want to replace from `value={inviteForm?.subject || ''}` up to `</>` with empty string
    
    # Wait, the easiest way is to just use a regex
    pattern = re.compile(r'value=\{inviteForm\?\.subject \|\| \'\'\}.*?\) : \(\s*<>\s*', re.DOTALL)
    content = pattern.sub('<>\n', content)
    
    # We also need to remove the trailing `)}` that closed the ternary
    # It looks like:
    #                               </div>
    #                             </>
    #                           )}
    #                         </div>
    pattern2 = re.compile(r'</>\s*\)\}\s*</div>', re.DOTALL)
    content = pattern2.sub('</>\n                          </div>', content)

    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)

    print("OfferApprovals patched successfully!")
except Exception as e:
    print("Error:", e)
