#!/usr/bin/env sh

# sed -i 's/Site 10/University of California—Berkeley/g' *.csv
# sed -i 's/Site 11/University of Michigan—Ann Arbor/g' *.csv
# sed -i 's/Site 12/Duke University/g' *.csv
# sed -i 's/Site 13/Northwestern University/g' *.csv
# sed -i 's/Site 14/University of California—Los Angeles (UCLA)/g' *.csv
# sed -i 's/Site 15/Johns Hopkins University/g' *.csv
# sed -i 's/Site 16/University of Southern California (USC)/g' *.csv
# sed -i 's/Site 17/University of Virginia/g' *.csv
# sed -i 's/Site 18/University of North Carolina—Chapel Hill/g' *.csv
# sed -i 's/Site 19/University of California—San Diego (UCSD)/g' *.csv
# sed -i 's/Site 20/University of Notre Dame/g' *.csv
# sed -i 's/Site 1/Harvard University/g' *.csv
# sed -i 's/Site 2/Stanford University/g' *.csv
# sed -i 's/Site 3/Massachusetts Institute of Technology (MIT)/g' *.csv
# sed -i 's/Site 4/California Institute of Technology (Caltech)/g' *.csv
# sed -i 's/Site 5/University of Chicago/g' *.csv
# sed -i 's/Site 6/Princeton University/g' *.csv
# sed -i 's/Site 7/Columbia University/g' *.csv
# sed -i 's/Site 8/Yale University/g' *.csv
# sed -i 's/Site 9/University of Pennsylvania/g' *.csv

# create data folder
mkdir data

cp Formatter_age45to54.csv data/age_45to54.csv
cp formatteralldem.csv data/breakdown_dem.csv
cp Formatter\ amantadine.csv data/amantadine.csv
cp Formatter\ baclofen.csv data/baclofen.csv
cp formattercohortnovmat2medalpha.csv data/no_vmat2_medalpha.csv
cp Formatter\ _elix.csv data/breakdown_elix.csv
cp Formatter\ female.csv data/female.csv
cp Formatter\ haloperidol.csv data/haloperidol.csv
cp Formatter\ no_vmat2_age45to54.csv data/no_vmat2_age_45to54.csv
cp Formatter\ no_vmat2_female.csv data/no_vmat2_female.csv
cp Formatter\ no_vmat2_male.csv data/no_vmat2_male.csv
cp Formatter_No_VMAT2_amatadine.csv data/no_vmat2_amatadine.csv
cp Formatter_No_VMAT2_halperidol.csv data/no_vmat2_halperidol.csv
cp Formatter\ vmat2_age45to54.csv data/vmat2_age_45to54.csv
cp Formatter\ vmat2_female.csv data/vmat2_female.csv
cp Formatter\ vmat2_male.csv data/vmat2_male.csv
cp Formatter_VMAT2_dem.csv data/vmat2_breakdown_dem.csv

sed -i 's/Site 10/UCSD/g' data/*.csv
sed -i 's/Site 11/UPitt/g' data/*.csv
sed -i 's/Site 12/USC Keck/g' data/*.csv
sed -i 's/Site 13/UTSW/g' data/*.csv
sed -i 's/Site 14/University of Missouri/g' data/*.csv
sed -i 's/Site 15/Washington University in St.Louis/g' data/*.csv
sed -i 's/Site 16/shrine-bidmc-test/g' data/*.csv
sed -i 's/Site 1/BIDMC/g' data/*.csv
sed -i 's/Site 2/Harvard-Mass General Brigham/g' data/*.csv
sed -i 's/Site 3/Kansas U (Not Active)/g' data/*.csv
sed -i 's/Site 4/MCW Test Node/g' data/*.csv
sed -i 's/Site 5/PennMedicine (Not Active)/g' data/*.csv
sed -i 's/Site 6/U Rochester/g' data/*.csv
sed -i 's/Site 7/UAB/g' data/*.csv
sed -i 's/Site 8/UC Davis Test/g' data/*.csv
sed -i 's/Site 9/UCLA/g' data/*.csv

exit 0
