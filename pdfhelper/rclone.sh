#!/bin/bash

# --- KONFIGURASI (SESUAIKAN DI SINI) ---
# Daftar folder di Raspberry Pi yang ingin di-backup (pisahkan dengan spasi)
SUMBER_FOLDERS=("compressed")

# Nama remote rclone yang Anda buat di Langkah 1
REMOTE_GDRIVE="gdrive"

# Folder tujuan di Google Drive
TUJUAN_BACKUP="00 PHD Research/My First SLR/PDFs"

# Lokasi file log
LOG_FILE="/var/log/rclone_backup.log"
# --- AKHIR KONFIGURASI ---

echo "==========================================" | tee -a $LOG_FILE
echo "Memulai proses backup pada $(date)" | tee -a $LOG_FILE
echo "==========================================" | tee -a $LOG_FILE

# Loop melalui setiap folder sumber
for folder in "${SUMBER_FOLDERS[@]}"; do
    # Mengekstrak nama dasar dari path folder
    nama_folder=$(basename "$folder")

    echo "--> Menyinkronkan folder: $folder" | tee -a $LOG_FILE

    # Perintah rclone sync
    # Opsi --create-empty-src-dirs memastikan folder kosong juga disalin
    rclone sync "$folder" "$REMOTE_GDRIVE:$TUJUAN_BACKUP/$nama_folder" -L --progress --create-empty-src-dirs --log-file=$LOG_FILE

    if [ $? -eq 0 ]; then
        echo "--> SUKSES: Sinkronisasi $folder selesai." | tee -a $LOG_FILE
    else
        echo "--> GAGAL: Terjadi kesalahan saat menyinkronkan $folder." | tee -a $LOG_FILE
    fi
    echo "" | tee -a $LOG_FILE
done

echo "Proses backup selesai pada $(date)" | tee -a $LOG_FILE
echo "==========================================" | tee -a $LOG_FILE
echo "" | tee -a $LOG_FILE
