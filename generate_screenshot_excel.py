import xlsxwriter

def create_excel():
    workbook = xlsxwriter.Workbook('Talent_Vault_Screenshot_Match.xlsx')
    ws = workbook.add_worksheet('Sheet1')
    
    # Formats
    bold = workbook.add_format({'bold': True})
    green_bg = workbook.add_format({'bg_color': '#C6E0B4', 'bold': True})
    yellow_bg = workbook.add_format({'bg_color': '#FFE699', 'bold': True})
    blue_bg = workbook.add_format({'bg_color': '#BDD7EE', 'bold': True})
    orange_bg = workbook.add_format({'bg_color': '#F8CBAD', 'bold': True})
    percent = workbook.add_format({'num_format': '0%'})
    float_fmt = workbook.add_format({'num_format': '0.00'})
    
    ws.set_column('B:B', 15)
    ws.set_column('C:D', 5)
    ws.set_column('E:I', 12)
    
    # Top legend
    ws.write('B2', 'Expert')
    ws.write('C2', 4)
    ws.write('B3', 'Advanced')
    ws.write('C3', 3)
    ws.write('B4', 'Intermediate')
    ws.write('C4', 2)
    ws.write('B5', 'Beginner')
    ws.write('C5', 1)
    
    # Requirement Breakdown
    ws.write('B7', 'Intermediate')
    ws.write('C7', '2 skill')
    ws.write('D7', 4)
    ws.write('B8', 'Advanced')
    ws.write('C8', '2 skill')
    ws.write('D8', 6)
    ws.write('B9', 'Expert')
    ws.write('C9', '5 skill')
    ws.write('D9', 20)
    
    ws.write('D10', 30, green_bg)
    ws.write('E10', 'Max Possible Score')
    
    # Column Headers for the comparison
    ws.write('B12', 'Skill')
    ws.write('C12', 'Req')
    ws.write('D12', 'Cand')
    ws.write('E12', 'Max Pts', green_bg)
    ws.write('F12', "Sir's Math", yellow_bg)
    ws.write('G12', "System Math", blue_bg)
    ws.write('H12', "Formula Used", bold)

    # Data rows (Skill 1 to 9)
    skills = [
        ('Skill 1', 'E', 'E', 4, 4, 4.00, "Perfect Match"),
        ('Skill 2', 'E', 'E', 4, 4, 4.00, "Perfect Match"),
        ('Skill 3', 'E', 'E', 4, 4, 4.00, "Perfect Match"),
        ('Skill 4', 'E', 'A', 4, 3, 3.46, "4 * SQRT(3/4)"),
        ('Skill 5', 'E', 'E', 4, 4, 4.00, "Perfect Match"),
        ('Skill 6', 'A', 'A', 3, 3, 3.00, "Perfect Match"),
        ('Skill 7', 'A', 'A', 3, 3, 3.00, "Perfect Match"),
        ('Skill 8', 'I', 'B', 2, 1, 1.41, "2 * SQRT(1/2)"),
        ('Skill 9', 'I', 'B', 2, 1, 1.41, "2 * SQRT(1/2)"),
    ]
    
    ws.write('A13', 'Candidate 1', bold)
    row = 12
    for s in skills:
        ws.write(row, 1, s[0])
        ws.write(row, 2, s[1])
        ws.write(row, 3, s[2])
        ws.write(row, 4, s[3], green_bg)
        ws.write(row, 5, s[4], yellow_bg)
        ws.write(row, 6, s[5], blue_bg)
        ws.write(row, 7, s[6])
        row += 1
        
    # Totals
    ws.write(row, 4, '=SUM(E13:E21)', green_bg)
    ws.write(row, 5, '=SUM(F13:F21)', yellow_bg)
    ws.write(row, 6, '=SUM(G13:G21)', blue_bg)
    
    ws.write(row+1, 5, '27 Actual')
    ws.write(row+1, 6, '28.28 Actual')
    
    # Raw Score
    ws.write(row+3, 5, '=F22/E22', float_fmt)
    ws.write(row+3, 6, '=G22/E22', float_fmt)
    
    # Curved Final Score
    ws.write(row+4, 5, '=(F25^0.5)', percent)
    ws.write(row+4, 6, '=(G25^0.5)', percent)
    
    ws.write(row+5, 5, "Sir's Final", bold)
    ws.write(row+5, 6, "System Final", bold)

    workbook.close()

if __name__ == "__main__":
    create_excel()
