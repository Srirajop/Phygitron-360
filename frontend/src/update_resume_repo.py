import codecs

file_path = r'd:\Downloads\Phygitron360\frontend\src\pages\source\ResumeRepo.jsx'
with open(file_path, 'r', encoding='utf-8') as f:
    text = f.read()

# Replace Year Header
search_year_header = """          {!currentYear && !currentFolder && (
            <div className="animate-fade-in">
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                <button className="btn btn-primary btn-sm" style={{ gap: 6 }} onClick={() => setShowFolderModal(true)}>
                  <Plus size={15} /> Create Folder
                </button>
              </div>"""

replace_year_header = """          {!currentYear && !currentFolder && (
            <div className="animate-fade-in">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 16 }}>
                <div style={{ position: 'relative', flex: 1, maxWidth: 300 }}>
                  <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="Search years..." 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    style={{ paddingLeft: 36, width: '100%', borderRadius: '8px' }}
                  />
                </div>
                <button className="btn btn-primary btn-sm" style={{ gap: 6 }} onClick={() => setShowFolderModal(true)}>
                  <Plus size={15} /> Create Folder
                </button>
              </div>"""

# Replace Year Map
search_year_map = """                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
                  {yearList.map((year, i) => ("""

replace_year_map = """                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
                  {yearList.filter(year => year.toString().includes(searchQuery)).map((year, i) => ("""


# Replace Month Header
search_month_header = """          {currentYear && !currentFolder && (
            <div className="animate-fade-in">
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                <button className="btn btn-primary btn-sm" style={{ gap: 6 }} onClick={() => setShowFolderModal(true)}>
                  <Plus size={15} /> Create Folder
                </button>
              </div>"""

replace_month_header = """          {currentYear && !currentFolder && (
            <div className="animate-fade-in">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 16 }}>
                <div style={{ position: 'relative', flex: 1, maxWidth: 300 }}>
                  <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="Search months..." 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    style={{ paddingLeft: 36, width: '100%', borderRadius: '8px' }}
                  />
                </div>
                <button className="btn btn-primary btn-sm" style={{ gap: 6 }} onClick={() => setShowFolderModal(true)}>
                  <Plus size={15} /> Create Folder
                </button>
              </div>"""

# Replace Month Map
search_month_map = """                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
                  {foldersForYear.map((f, i) => ("""

replace_month_map = """                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
                  {foldersForYear.filter(f => f.label.toLowerCase().includes(searchQuery.toLowerCase())).map((f, i) => ("""


if search_year_header in text and search_year_map in text and search_month_header in text and search_month_map in text:
    text = text.replace(search_year_header, replace_year_header)
    text = text.replace(search_year_map, replace_year_map)
    text = text.replace(search_month_header, replace_month_header)
    text = text.replace(search_month_map, replace_month_map)
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(text)
    print("Success")
else:
    print("Search string not found")
    if search_year_header not in text: print("year header missing")
    if search_year_map not in text: print("year map missing")
    if search_month_header not in text: print("month header missing")
    if search_month_map not in text: print("month map missing")
