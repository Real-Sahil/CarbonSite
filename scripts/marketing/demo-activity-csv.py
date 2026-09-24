# Generates the demo tenant activity CSVs (Northgate Civils Ltd, fictional) used
# for marketing captures. Import them through Imports with template ghg_protocol_v1.
import csv, json
H=["Amount","Unit","Category Code","Activity Date","Start Date","End Date","Source Description","Facility","Business Unit","Supplier","Country","Region","Fuel Type","Transport Mode","Refrigerant Type","Distance","Distance Unit","Spend Amount","Spend Currency","Scope 2 Method","Assumption Notes","Industry Code"]
Q=[("01-01","03-31"),("04-01","06-30"),("07-01","09-30"),("10-01","12-31")]
season=[1.25,0.85,0.75,1.15]
def rows(y,k):
    out=[]
    def add(amount,unit,cat,q,desc,fac,sup="",fuel="",mode="",refr="",spend="",cur="",s2="",ind="",note=""):
        s,e=Q[q]; out.append([round(amount,1) if amount!="" else "",unit,cat,f"{y}-{e}",f"{y}-{s}",f"{y}-{e}",desc,fac,"",sup,"GB","",fuel,mode,refr,"","",spend,cur,s2,note,ind])
    for q in range(4):
        # fleet diesel
        add(38000*k,"litres","s1-mobile",q,"Fleet diesel, fuel card","Leeds depot","Certas Energy","diesel")
        add(21000*k,"litres","s1-mobile",q,"Plant diesel, bowser deliveries","A61 corridor works","Certas Energy","diesel")
        if y==2025: add(6500,"litres","s1-mobile",q,"Plant HVO trial","A61 corridor works","Certas Energy","HVO")
        add(15500*k,"litres","s1-mobile",q,"Plant diesel, bowser deliveries","York Road bridge","Certas Energy","diesel")
        add(9000*k,"litres","s1-stationary",q,"Site generators","A61 corridor works","Certas Energy","diesel")
        add(6200*k,"litres","s1-stationary",q,"Site generators","York Road bridge","Certas Energy","diesel")
        add(42000*season[q]*k,"kWh","s1-stationary",q,"Office heating, gas meter","Head office, Wakefield","British Gas","natural gas")
        add(64000*season[q]*k,"kWh","s1-stationary",q,"Aggregate drying, gas meter","Sheffield batching plant","British Gas","natural gas")
        for f,v in [("Leeds depot",48000),("Sheffield batching plant",121000),("Head office, Wakefield",36000),("A61 corridor works",22000),("York Road bridge",17000)]:
            add(v*season[q]**0.5*k,"kWh","s2-electricity-lb",q,"Half-hourly meter","%s"%f,"EDF Energy",s2="location_based")
        add(185*k,"tonnes","s3-waste",q,"Mixed C&D waste, EWC 17 09 04","A61 corridor works","Yorwaste")
        add(120*k,"tonnes","s3-waste",q,"Mixed C&D waste, EWC 17 09 04","York Road bridge","Yorwaste")
        add(9200*k,"km","s3-business-travel",q,"Rail travel, travel desk","Head office, Wakefield","Trainline",mode="rail")
        add(14500*k,"km","s3-business-travel",q,"Grey fleet mileage claims","Head office, Wakefield",mode="car")
        add(61000*k,"km","s3-commuting",q,"Staff commuting survey","Head office, Wakefield",mode="car")
        add(410000*k, "GBP","s3-purchased-goods",q,"Ready-mix concrete","A61 corridor works","Tarmac",spend=round(410000*k),cur="GBP",ind="23.63")
        add(265000*k, "GBP","s3-purchased-goods",q,"Reinforcing steel","York Road bridge","Celsa Steel UK",spend=round(265000*k),cur="GBP",ind="24.10")
    add(1.6,"kg","s1-fugitive",3,"Air conditioning top-up, F-gas log","Head office, Wakefield","Coolserve",refr="R410A")
    return out
for y,k in [(2024,1.0),(2025,0.9)]:
    with open(f"demo-activity-{y}.csv","w",newline="") as f:
        w=csv.writer(f); w.writerow(H); w.writerows(rows(y,k))
    print(y, len(rows(y,k)))
